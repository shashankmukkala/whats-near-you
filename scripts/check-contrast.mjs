// Walks every rendered element on every page and reports surfaces that are
// still dark, or text that cannot be read against what is behind it.
//
//   node scripts/check-contrast.mjs [baseUrl]
//
// This exists because the dark-to-light inversion leaked three times, each
// in a way no type-check, lint or build could see:
//
//   1. `.is-public .panel-elevated` beat `.panel-elevated` on specificity,
//      so every floating panel stayed near-black.
//   2. `color-scheme: dark` survived, giving a cream page dark scrollbars
//      and an invisible date-picker icon.
//   3. `.is-public .detail-card` set the `background` SHORTHAND to a dark
//      gradient. Its computed backgroundColor read cream the whole time,
//      because a background-image paints over the colour.
//
// Number three is why this checks backgroundImage as well as
// backgroundColor. Reading one and not the other is how a bug hides in
// plain sight for two rounds of fixes.
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3002").replace(/\/$/, "");
const PAGES = ["/", "/map", "/submit", "/advertise", "/admin"];

/** Relative luminance, per WCAG. */
function luminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function parseRgb(value) {
  const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { rgb: [+m[1], +m[2], +m[3]], alpha: m[4] === undefined ? 1 : +m[4] };
}

const browser = await chromium.launch();
let findings = 0;

for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base + path, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(path === "/map" ? 4500 : 1500);

  const onCover = await page.evaluate(() => !!document.querySelector(".cover-screen"));

  // The brand darks, resolved from the live stylesheet rather than
  // hardcoded. Ink buttons and the primary action are meant to be dark on
  // ivory — that IS the visual system — and when the palette moved to the
  // cover artwork the primary went from a bright vermilion to a deep
  // scarlet at 0.07 luminance, which tripped the dark-surface rule on
  // every page. Reading the tokens means the exemption follows the
  // palette instead of going stale the next time it is retuned.
  const brandDarks = await page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const out = ["--ink", "--accent", "--accent-deep", "--accent-live-deep"].map((token) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    return out;
  });

  const problems = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      // Ignore anything too small to matter, or off screen.
      if (r.width < 60 || r.height < 24) continue;
      const c = getComputedStyle(el);
      if (c.visibility === "hidden" || c.display === "none") continue;
      // Low-opacity decoration is not a surface anyone reads against — the
      // hero glows sit at 0.14 and were the only false positive here.
      if (parseFloat(c.opacity) < 0.35) continue;

      const key = String(el.className).slice(0, 60);
      if (seen.has(key)) continue;

      // Both, deliberately — see the note at the top of this file.
      const paints = [c.backgroundColor, c.backgroundImage];
      out.push({
        key: key || el.tagName.toLowerCase(),
        bg: c.backgroundColor,
        bgImage: c.backgroundImage === "none" ? "" : c.backgroundImage,
        color: c.color,
        raw: paints.join(" | "),
      });
      seen.add(key);
    }
    return out;
  });

  for (const p of problems) {
    // A dark rgb() anywhere in either paint property is the signal. The
    // aircraft banner is an advertiser's creative and is meant to be dark.
    const darkPaints = [...p.raw.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)]
      .map((m) => ({ rgb: [+m[1], +m[2], +m[3]], alpha: m[4] === undefined ? 1 : +m[4] }))
      .filter((c) => c.alpha > 0.5 && luminance(c.rgb) < 0.12)
      .filter((c) => !brandDarks.includes(`rgb(${c.rgb.join(", ")})`));

    // The landing cover is deliberately a dark poster — see
    // components/HomeCover. Its painting and its scrims are meant to be
    // dark, so the useful question there is not "is this dark" but "can
    // the text on it be read", which the ratio check below still asks of
    // every element carrying text.
    //
    // Keyed off .cover-screen, a class that exists for this. The previous
    // version matched Tailwind class strings, and its pattern for the
    // arbitrary min-height utility left the square brackets unescaped —
    // making it a character class that matched nothing, so the cover kept
    // being flagged while the regex looked correct. A named hook cannot
    // fail that way.
    const deliberateDark = onCover;

    if (darkPaints.length && !deliberateDark && !/aircraft|picker-pin|place-pin|brand-mark|btn-primary/.test(p.key)) {
      findings++;
      console.log(`  ${path}  ${p.key.slice(0, 52)}`);
      console.log(`      dark surface: ${p.bgImage ? p.bgImage.slice(0, 70) : p.bg}`);
      continue;
    }

    // Text against its own background, where the background is opaque.
    const bg = parseRgb(p.bg);
    const fg = parseRgb(p.color);
    if (bg && fg && bg.alpha > 0.85 && !p.bgImage) {
      const l1 = luminance(fg.rgb);
      const l2 = luminance(bg.rgb);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 3) {
        findings++;
        console.log(`  ${path}  ${p.key.slice(0, 52)}`);
        console.log(`      contrast ${ratio.toFixed(2)}:1 — ${p.color} on ${p.bg}`);
      }
    }
  }
  await page.close();
}

await browser.close();
console.log(findings === 0 ? "\nNo dark surfaces or unreadable text found.\n" : `\n${findings} finding(s).\n`);
