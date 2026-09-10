// Turns the source artwork into the two framings the cover actually needs.
//
//   node scripts/build-home-art.mjs [assets/home-source.png]
//
// One painting, two crops, because a landscape illustration and a phone
// are the wrong shape for each other and `object-cover` alone resolves
// that badly. At 1704x923 the source is 1.85:1; a phone is about 0.46:1.
// Covering a phone with the wide file shows a 25%-wide vertical slice of
// it — and then asks the browser to blow that slice up to a 1170px-wide
// retina screen, a ~4x upscale of a quarter of the picture.
//
// So the phone gets its own crop, framed on the shrine, and the upscaling
// happens here with a real resampling kernel instead of in the browser.
//
//   public/home-wide.webp   the street, for anything landscape
//   public/home-tall.webp   the shrine, for anything portrait
//
// Both stop short of x=1493, where the painting's own right-hand signage
// begins — the hanging "GANESH UTSAV HYD" banner and the "GANPATI BAPPA
// MORYA" board. They are lovely, and they are painted words that cannot
// be clicked. The cover runs its real navigation down that same right
// edge, and a reader who sees six lines of cream capitals stacked in one
// column will reasonably try to tap all six. Cropping them out is cheaper
// than losing that argument on every visit.
//
// Upscaling is defensible for THIS image and would not be for a photo:
// it is flat-shaded illustration, all large areas of even colour and soft
// edges, which is the one thing lanczos handles without inventing
// texture. The grain the cover lays over the top is an SVG filter and
// stays crisp at any density, which is what actually sells the surface —
// so a slightly soft base costs less than it sounds like it should.
import sharp from "sharp";
import fs from "node:fs";

const SOURCE = process.argv[2] ?? "assets/home-source.png";
if (!fs.existsSync(SOURCE)) {
  console.error(`No source at ${SOURCE}`);
  process.exit(1);
}

const { width: W, height: H } = await sharp(SOURCE).metadata();
console.log(`\nsource ${SOURCE} — ${W}x${H}`);

async function write(path, image, targetW) {
  await image.resize(targetW, null, { kernel: "lanczos3" }).webp({ quality: 78, effort: 6 }).toFile(path);
  const m = await sharp(path).metadata();
  const kb = (fs.statSync(path).size / 1024).toFixed(0);
  console.log(`  ${path.padEnd(24)} ${m.width}x${m.height}  ${kb}KB`);
}

// Where the painted right-hand signage starts. Both crops keep clear of it.
const SIGNAGE_X = 1493;

console.log("");

// Wide: the street, trimmed at the signage. 1493x923 is about 1.62:1, so
// a 16:9 window crops a little off the top and bottom — tree canopy and
// the backs of the nearest heads, neither of which is the subject.
await write(
  "public/home-wide.webp",
  sharp(SOURCE).extract({ left: 0, top: 0, width: SIGNAGE_X, height: H }),
  2400
);

// Tall: centred on the shrine, which lands well inside the same limit.
const CROP_W = 646;
const SHRINE_CENTRE = 1195;
await write(
  "public/home-tall.webp",
  sharp(SOURCE).extract({
    left: Math.round(SHRINE_CENTRE - CROP_W / 2),
    top: 0,
    width: CROP_W,
    height: H,
  }),
  1600
);

console.log("");
