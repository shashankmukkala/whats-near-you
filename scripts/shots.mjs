// Screenshots every page at phone and desktop widths, and reports any
// console errors or failed requests it saw on the way.
//
//   node scripts/shots.mjs                     # against localhost:3002
//   node scripts/shots.mjs https://…           # against a deployment
//   node scripts/shots.mjs --only=map,submit   # just those
//
// Why this exists: the whole UI was inverted from dark to light without
// anyone looking at it, and the one screenshot that did get taken found a
// bug — panels still dark — that type-checking, linting and a clean build
// had all sailed straight past. Those tools prove the code runs. They say
// nothing about whether it can be read.
//
// Shots land in .shots/ (gitignored).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3002").replace(/\/$/, "");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");

const PAGES = [
  { name: "home", path: "/" },
  { name: "map", path: "/map" },
  { name: "submit", path: "/submit" },
  { name: "advertise", path: "/advertise" },
  { name: "admin", path: "/admin" },
];

// Phone first, deliberately. This is a product used outdoors at night on a
// handset; the desktop view is the secondary case.
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1440, height: 900, isMobile: false },
];

const OUT = ".shots";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const targets = PAGES.filter((p) => !only || only.includes(p.name));
let problems = 0;

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: 2,
    // Fixed so "3 days left" style copy does not shift between runs.
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  });

  for (const target of targets) {
    const page = await context.newPage();
    const issues = [];
    page.on("console", (m) => m.type() === "error" && issues.push(`console: ${m.text().slice(0, 160)}`));
    page.on("pageerror", (e) => issues.push(`pageerror: ${String(e).slice(0, 160)}`));
    page.on("requestfailed", (r) => {
      // Map tiles fail individually all the time on a throttled connection
      // and say nothing about the page being broken.
      if (!/openfreemap|tiles/.test(r.url())) issues.push(`request failed: ${r.url().slice(0, 100)}`);
    });

    try {
      await page.goto(base + target.path, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      // networkidle never settles on the map — MapLibre keeps fetching
      // tiles as you move. Falling back to "the document parsed" plus a
      // pause is enough for a screenshot.
      await page.goto(base + target.path, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    }
    // Long enough for tiles, fonts and the card entrance animation.
    await page.waitForTimeout(target.name === "map" ? 4500 : 1800);

    const file = path.join(OUT, `${target.name}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: !viewport.isMobile && target.name !== "map" });

    problems += issues.length;
    console.log(`  ${file}${issues.length ? `\n      ⚠ ${issues.slice(0, 4).join("\n      ⚠ ")}` : ""}`);
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(`\n${targets.length * VIEWPORTS.length} shots in ${OUT}/ — ${problems} console/network issue(s)\n`);
