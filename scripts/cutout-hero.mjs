// Removes the flat background from the hero illustration, once.
//
//   node scripts/cutout-hero.mjs assets/ganesha-source.png public/ganesha-cutout.png
//
// The artwork arrives on a solid #fdf9ef ground. That is a shade lighter
// than the page's #fdf3e0, so dropping it straight in leaves a pale square
// around it, and mix-blend-multiply — the usual trick — only converts that
// into a DARKER square wherever the hero's gradient sits behind it.
// Neither is acceptable on the first thing anyone sees.
//
// So the background becomes actually transparent. This is a one-off build
// step rather than runtime work: the result is committed, and the site just
// loads a PNG with an alpha channel.
//
// The tolerance-plus-edge-fade approach matters. A hard threshold leaves a
// visible halo of near-background pixels around every curve — the artwork
// is anti-aliased, so its edges are blends of ink and background. Fading
// alpha across a band instead keeps those edges smooth against whatever
// colour ends up behind them.
import sharp from "sharp";

// The source sits outside public/ deliberately: it is the input to this
// script, not something the site should serve.
const [, , input = "assets/ganesha-source.png", output = "public/ganesha-cutout.png"] = process.argv;

// Sampled from the file's own top-left pixel rather than assumed.
const BG = { r: 253, g: 249, b: 239 };
// Fully transparent at or below this distance from the background colour,
// fully opaque above the outer bound, and a smooth ramp between.
const INNER = 10;
const OUTER = 34;

const image = sharp(input).ensureAlpha();
const { width, height } = await image.metadata();
const raw = await image.raw().toBuffer();

let cleared = 0;
for (let i = 0; i < raw.length; i += 4) {
  const dr = raw[i] - BG.r;
  const dg = raw[i + 1] - BG.g;
  const db = raw[i + 2] - BG.b;
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);

  if (distance <= INNER) {
    raw[i + 3] = 0;
    cleared++;
  } else if (distance < OUTER) {
    // Linear ramp across the anti-aliased edge band.
    raw[i + 3] = Math.round(((distance - INNER) / (OUTER - INNER)) * 255);
  }
}

await sharp(raw, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

const pct = ((cleared / (width * height)) * 100).toFixed(1);
console.log(`\n${input} -> ${output}`);
console.log(`  ${width}x${height}, ${pct}% of pixels made transparent\n`);
