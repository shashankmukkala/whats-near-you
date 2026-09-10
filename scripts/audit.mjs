// Walks the whole site and reports what is actually broken.
//
//   node scripts/audit.mjs                      # localhost:3002
//   node scripts/audit.mjs https://…            # a deployment
//
// Exercises real interactions rather than just loading pages: opens a
// pandal card, runs a search, toggles filters, fills both forms far enough
// to reveal what they gate, and follows a deep link. Every check is either
// PASS or FAIL with the evidence that decided it — nothing is asserted
// from reading the source.
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3002").replace(/\/$/, "");
const results = [];
const pass = (area, what, detail = "") => results.push({ ok: true, area, what, detail });
const fail = (area, what, detail = "") => results.push({ ok: false, area, what, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  timezoneId: "Asia/Kolkata",
  locale: "en-IN",
});

/** Every page error and failed request, per page, so a silent break shows. */
function watch(page, area) {
  page.on("pageerror", (e) => fail(area, "no page errors", String(e).slice(0, 110)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|tiles|openfreemap/.test(m.text())) {
      fail(area, "no console errors", m.text().slice(0, 110));
    }
  });
  page.on("requestfailed", (r) => {
    // An aborted request is not a broken one. Next cancels in-flight RSC
    // prefetches the moment you navigate away, and counting those as
    // failures reported two healthy pages as broken — confirmed by
    // fetching the same URL directly and getting 200 with valid content.
    const reason = r.failure()?.errorText ?? "";
    if (/ABORTED|CANCEL/i.test(reason)) return;
    if (!/openfreemap|tiles|\.png|favicon/.test(r.url())) {
      fail(area, "no failed requests", `${r.url().slice(0, 70)} (${reason})`);
    }
  });
}

async function open(path, area, waitMs = 1800) {
  const page = await ctx.newPage();
  watch(page, area);
  const res = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  const status = res?.status() ?? 0;
  if (status === 200) pass(area, `${path} responds`, "200");
  else fail(area, `${path} responds`, `HTTP ${status}`);
  await page.waitForTimeout(waitMs);
  return page;
}

// ---------------------------------------------------------------- home
{
  const page = await open("/", "home");
  const links = await page.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  for (const href of ["/map", "/submit", "/advertise"]) {
    links.includes(href) ? pass("home", `links to ${href}`) : fail("home", `links to ${href}`, "missing");
  }
  const stats = await page.locator("dt").allTextContents();
  stats.length === 3 && stats.every((s) => /^\d+$/.test(s.trim()))
    ? pass("home", "stat row reads real numbers", stats.join(" / "))
    : fail("home", "stat row reads real numbers", stats.join(" / ") || "none");
  const heroImg = await page.locator("img").first().evaluate((el) => el.naturalWidth).catch(() => 0);
  heroImg > 0 ? pass("home", "hero image loads", `${heroImg}px wide`) : fail("home", "hero image loads", "naturalWidth 0");
  await page.close();
}

// ----------------------------------------------------------------- map
{
  const page = await open("/map", "map", 5000);
  const pins = await page.locator(".place-pin").count();
  pins > 0 ? pass("map", "pins render", `${pins} pins`) : fail("map", "pins render", "none");

  // Open a card by name, avoiding the Secunderabad clump where pins overlap.
  const target = page.locator('[aria-label="Open Khairatabad Ganesh"]');
  if (await target.count()) {
    await target.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const card = await page.locator(".detail-card").count();
    card ? pass("map", "card opens on pin click") : fail("map", "card opens on pin click", "no .detail-card");

    const directions = await page.locator('.detail-card a[href*="maps"]').count();
    directions ? pass("map", "card has a Directions link") : fail("map", "card has a Directions link", "missing");

    // Close it again — the X, which is the path most people take.
    await page.locator(".detail-card .panel-close-button").click().catch(() => {});
    await page.waitForTimeout(900);
    (await page.locator(".detail-card").count()) === 0
      ? pass("map", "card closes")
      : fail("map", "card closes", "still open");
  } else fail("map", "card opens on pin click", "Khairatabad pin not found");

  // Search
  const search = page.locator(".search-input");
  await search.fill("ram nagar");
  await page.waitForTimeout(1600);
  const results1 = await page.locator(".panel-elevated").filter({ hasText: "match" }).count();
  results1 ? pass("map", "search finds an area") : fail("map", "search finds an area", "no results panel");
  await search.fill("");
  await page.waitForTimeout(900);

  // Live toggle
  await page.locator(".live-toggle").click().catch(() => {});
  await page.waitForTimeout(1200);
  const liveActive = await page.locator(".live-toggle.is-active").count();
  liveActive ? pass("map", "Live now toggles") : fail("map", "Live now toggles", "no active state");
  await page.locator(".live-toggle").click().catch(() => {});
  await page.waitForTimeout(600);

  // Filters panel
  await page.locator(".chip-trigger").first().click().catch(() => {});
  await page.waitForTimeout(800);
  const chips = await page.locator(".filter-chip").count();
  chips > 1 ? pass("map", "filter panel opens", `${chips} chips`) : fail("map", "filter panel opens", `${chips} chips`);

  // Ad rail
  const railSlots = await page.locator(".ad-rail-slot").count();
  railSlots === 5 ? pass("map", "ad rail shows 5 slots") : fail("map", "ad rail shows 5 slots", `${railSlots}`);
  const railLink = await page.locator('.ad-rail a[href*="advertise"], .ad-rail button').count();
  railLink ? pass("map", "ad rail is clickable") : fail("map", "ad rail is clickable", "no control");

  await page.close();
}

// ---------------------------------------------------------- deep links
{
  const list = await fetch(`${base}/api/places`).then((r) => r.json()).catch(() => []);
  if (Array.isArray(list) && list.length) {
    pass("api", "/api/places returns rows", `${list.length}`);
    const leak = ["verification_status", "coord_source"].filter((k) => k in list[0]);
    leak.length ? fail("api", "no internal fields in payload", leak.join(",")) : pass("api", "no internal fields in payload");

    const id = list.find((p) => /Khairatabad/.test(p.name))?.id ?? list[0].id;
    const page = await open(`/map?place=${id}`, "deeplink", 5000);
    (await page.locator(".detail-card").count())
      ? pass("deeplink", "?place= opens the card")
      : fail("deeplink", "?place= opens the card", "no card");
    await page.close();

    // The legacy shape, which is still out in the world on shared links.
    const legacy = await fetch(`${base}/?place=${id}`, { redirect: "manual" });
    [307, 308, 302].includes(legacy.status)
      ? pass("deeplink", "/?place= redirects to /map", `HTTP ${legacy.status}`)
      : fail("deeplink", "/?place= redirects to /map", `HTTP ${legacy.status}`);

    const og = await fetch(`${base}/map?place=${id}`).then((r) => r.text());
    const image = og.match(/<meta property="og:image" content="([^"]*)"/)?.[1] ?? "";
    image.startsWith(base) ? pass("seo", "og:image points at this host", image.replace(base, ""))
      : fail("seo", "og:image points at this host", image || "missing");
    const ogImg = await fetch(image.startsWith("http") ? image : base + image);
    ogImg.ok && (ogImg.headers.get("content-type") ?? "").includes("image")
      ? pass("seo", "preview image renders", ogImg.headers.get("content-type"))
      : fail("seo", "preview image renders", `HTTP ${ogImg.status}`);
  } else fail("api", "/api/places returns rows", JSON.stringify(list).slice(0, 80));
}

// -------------------------------------------------------------- submit
{
  const page = await open("/submit", "submit", 4500);
  const map = await page.locator(".maplibregl-canvas").count();
  map ? pass("submit", "location picker map loads") : fail("submit", "location picker map loads", "no canvas");

  const submitBtn = page.locator('button[type="submit"]');
  (await submitBtn.isDisabled())
    ? pass("submit", "submit is blocked until valid")
    : fail("submit", "submit is blocked until valid", "enabled on an empty form");

  const width = await page.locator(".field-input").first().evaluate((el) => el.getBoundingClientRect().width);
  width > 300 ? pass("submit", "inputs are full width", `${Math.round(width)}px`)
    : fail("submit", "inputs are full width", `${Math.round(width)}px`);

  // "Use link" against a real shortened Maps URL.
  await page.locator('input[placeholder*="Google Maps"]').fill("https://maps.app.goo.gl/a3g9VXiotMFFpWkw5");
  await page.locator('button:has-text("Use link")').click();
  await page.waitForTimeout(6000);
  const pinSet = await page.locator("text=Pin set at").count();
  pinSet ? pass("submit", "pasted Maps link sets the pin") : fail("submit", "pasted Maps link sets the pin", "no pin");
  await page.close();
}

// ----------------------------------------------------------- advertise
{
  const page = await open("/advertise", "advertise", 1500);
  const cards = await page.locator(".card-elevated").count();
  cards >= 2 ? pass("advertise", "both placements are offered", `${cards}`)
    : fail("advertise", "both placements are offered", `${cards}`);
  await page.close();

  for (const placement of ["map", "card"]) {
    const p = await open(`/advertise/${placement}`, `advertise/${placement}`, 1500);
    const gated = await p.locator("text=payment details appear here").count();
    gated ? pass(`advertise/${placement}`, "payment gated before details")
      : fail(`advertise/${placement}`, "payment gated before details", "not gated");

    await p.locator("input").nth(0).fill("Audit Co");
    await p.locator('input[type="tel"]').fill("9876543210");
    await p.locator('input[type="file"]').first().setInputFiles("assets/ganesha-source.png");
    await p.waitForTimeout(7000);

    const upiCode = await p.locator("code").first().textContent().catch(() => null);
    const notConfigured = await p.locator("text=Payment is not set up yet").count();
    if (notConfigured) fail(`advertise/${placement}`, "UPI id is configured", "shows the not-set-up message");
    else if (upiCode) pass(`advertise/${placement}`, "UPI id is configured", upiCode.trim());
    else fail(`advertise/${placement}`, "UPI id is configured", "no UPI shown");

    const qr = await p.locator('img[alt="UPI payment QR code"]').count();
    qr ? pass(`advertise/${placement}`, "QR renders") : fail(`advertise/${placement}`, "QR renders", "missing");

    const previews = await p.locator('button:has-text("Remove")').count();
    previews === 1 ? pass(`advertise/${placement}`, "one upload gives one preview")
      : fail(`advertise/${placement}`, "one upload gives one preview", `${previews}`);
    await p.close();
  }
}

// --------------------------------------------------------------- admin
{
  const page = await open("/admin", "admin", 2500);
  const signIn = await page.locator('input[type="password"]').count();
  signIn ? pass("admin", "sign-in gate shown to anonymous") : fail("admin", "sign-in gate shown to anonymous", "no password field");
  await page.close();

  for (const path of ["/admin/submissions", "/admin/ad-enquiries", "/admin/billboards"]) {
    const p = await open(path, "admin", 2000);
    (await p.locator('input[type="password"]').count())
      ? pass("admin", `${path} is gated`)
      : fail("admin", `${path} is gated`, "no sign-in");
    await p.close();
  }
}

// ------------------------------------------------------------- 404 etc
{
  const res = await fetch(`${base}/definitely-not-a-page`);
  res.status === 404 ? pass("misc", "unknown route 404s") : fail("misc", "unknown route 404s", `HTTP ${res.status}`);
  const bad = await fetch(`${base}/advertise/nonsense`);
  bad.status === 404 ? pass("misc", "unknown ad placement 404s") : fail("misc", "unknown ad placement 404s", `HTTP ${bad.status}`);
}

await browser.close();

// ------------------------------------------------------------- report
const failures = results.filter((r) => !r.ok);
const seen = new Set();
console.log(`\nAudit of ${base}\n`);
for (const r of results) {
  const key = `${r.area}|${r.what}|${r.detail}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!r.ok) console.log(`  FAIL  [${r.area}] ${r.what}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(
  `\n${results.filter((r) => r.ok).length} passed, ${new Set(failures.map((f) => `${f.area}|${f.what}|${f.detail}`)).size} distinct failure(s)\n`
);
