// Turns the source logo into the four sizes the site actually needs.
//
//   node scripts/build-logo-assets.mjs
//
// One source, four outputs, because each has a different job and a
// different constraint:
//
//   public/logo-mark.png   transparent, 256px — map pins and the OG card.
//                          Transparent because it sits on a white pin and
//                          on a cream card, and a baked-in white square
//                          would show as a box on both.
//   public/logo.png        transparent, 512px — the site header.
//   app/icon.png           512px on cream — the browser tab and the icon
//                          Android uses. NOT transparent: a tab bar can be
//                          any colour, and dark ink on nothing disappears
//                          against a dark one.
//   app/apple-icon.png     180px on cream — iOS home screen, which fills
//                          transparency with black.
//
// Run again whenever logo.png changes. Outputs are committed, so the site
// never does this work at request time.
import sharp from "sharp";
import fs from "node:fs";

const SOURCE = process.argv[2] ?? "assets/logo-source.png";
if (!fs.existsSync(SOURCE)) {
  console.error(`No source at ${SOURCE}`);
  process.exit(1);
}

const raw = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = raw.info;

// Does the source ALREADY have a transparent background? Checked rather
// than assumed, and this matters more than it sounds.
//
// The first version of this sampled the top-left pixel as the colour to
// knock out. On a PNG that is already transparent that pixel is
// rgba(0,0,0,0) — so it concluded the background was pure black and began
// erasing everything near black, which on this logo is the linework
// itself. It only survived because the darkest ink here is #161616, a
// distance of 38 from black and just outside the knock-out band; even so
// the boldest strokes were coming out at 93% alpha rather than full. A
// logo drawn in true black would have disappeared completely.
let transparent = 0;
for (let i = 3; i < raw.data.length; i += 4) if (raw.data[i] === 0) transparent++;
const alreadyCut = transparent / (width * height) > 0.2;

let cutout;
if (alreadyCut) {
  console.log(
    `\nsource ${SOURCE} — already transparent (${((transparent / (width * height)) * 100).toFixed(1)}%), left alone`
  );
  cutout = await sharp(raw.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
} else {
  const BG = { r: raw.data[0], g: raw.data[1], b: raw.data[2] };
  console.log(`\nsource ${SOURCE} — flat background, knocking it out`);
  // Ramped rather than hard-thresholded: a hard cut leaves a visible
  // fringe on every antialiased curve, and this logo is all curves.
  const INNER = 12;
  const OUTER = 40;
  const pixels = Buffer.from(raw.data);
  let cleared = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const d = Math.hypot(pixels[i] - BG.r, pixels[i + 1] - BG.g, pixels[i + 2] - BG.b);
    if (d <= INNER) {
      pixels[i + 3] = 0;
      cleared++;
    } else if (d < OUTER) {
      pixels[i + 3] = Math.round(((d - INNER) / (OUTER - INNER)) * 255);
    }
  }
  cutout = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  console.log(`  ${((cleared / (width * height)) * 100).toFixed(1)}% made transparent`);
}

// Trim the empty margin first. The source has generous padding, which at
// pin size would shrink the mark itself to almost nothing.
const trimmed = await sharp(cutout).trim({ threshold: 1 }).toBuffer();

async function write(path, size, background) {
  let image = sharp(trimmed).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (background) {
    // Padding so the mark is not flush against the tile's edge, then the
    // cream behind it.
    const inset = Math.round(size * 0.12);
    image = sharp({
      create: { width: size, height: size, channels: 4, background },
    }).composite([
      {
        input: await sharp(trimmed)
          .resize(size - inset * 2, size - inset * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer(),
        top: inset,
        left: inset,
      },
    ]);
  }
  await image.png({ compressionLevel: 9 }).toFile(path);
  const kb = (fs.statSync(path).size / 1024).toFixed(0);
  console.log(`  ${path.padEnd(24)} ${size}px  ${kb}KB${background ? "  on cream" : "  transparent"}`);
}

const cream = { r: 253, g: 243, b: 224, alpha: 1 };
console.log("");
await write("public/logo-mark.png", 256, null);
await write("public/logo.png", 512, null);
await write("app/icon.png", 512, cream);
await write("app/apple-icon.png", 180, cream);
console.log("");
