import type { Map as MapLibreMap } from "maplibre-gl";

// OpenFreeMap's "liberty" style (the base style — see OPENFREEMAP_STYLE_URL
// in mapStyle.ts) is a light basemap, and it's the only OpenFreeMap style
// with real 3D building extrusion (their "dark" style uses flat 2D
// buildings, which would kill the app's whole 3D-toggle feature). So
// instead of switching styles, this repaints "liberty" dark at runtime by
// inverting the lightness of every color in every layer's paint — the same
// technique tools like Mapbox's "invert lightness" recipe use. It's a
// single generic pass rather than hand-tuning ~90 individual layers:
// light backgrounds/fills/land invert to dark, dark label text inverts to
// light, light label halos invert to dark halos — all from one rule.
//
// Buildings and roads are excluded here and handled separately in Map.tsx
// with hand-picked colors (buildings need a height-based ramp the base
// style doesn't have at all; roads need colors tuned for readability, not
// just a mechanical inversion) — those overrides are applied AFTER this
// pass runs, so they win.
const PAINT_COLOR_PROPS: Partial<Record<string, string[]>> = {
  background: ["background-color"],
  fill: ["fill-color", "fill-outline-color"],
  "fill-extrusion": ["fill-extrusion-color"],
  line: ["line-color"],
  symbol: ["text-color", "text-halo-color", "icon-color"],
};

const COLOR_LIKE_RE = /^\s*(#|rgb\(|rgba\(|hsl\(|hsla\()/i;

function isColorLike(value: unknown): value is string {
  return typeof value === "string" && COLOR_LIKE_RE.test(value);
}

// Parses any valid CSS color string (hex/rgb/rgba/hsl/hsla/named) into
// components by letting the browser's own canvas color parser normalize
// it, instead of hand-rolling a parser for every format the style uses.
function parseColor(cssColor: string): { r: number; g: number; b: number; a: number } | null {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = cssColor;
  const normalized = ctx.fillStyle;

  const hex = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  }
  const rgb = normalized.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/i);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] !== undefined ? +rgb[4] : 1 };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Inverting lightness directly (100 - L) does the right thing in both
// directions at once: a near-white background (L≈97%) becomes near-black
// (L≈3%), and near-black label text (L≈0%) becomes near-white (L≈100%) —
// so both fills and labels come out correctly from the same rule. Clamped
// short of pure black/white so nothing goes fully invisible against the
// aurora backdrop behind the map.
function invertLightness(cssColor: string): string {
  const parsed = parseColor(cssColor);
  if (!parsed) return cssColor;
  const [h, s, l] = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const newL = Math.max(4, Math.min(94, 100 - l));
  const [r, g, b] = hslToRgb(h, s, newL);
  return parsed.a < 1 ? `rgba(${r},${g},${b},${parsed.a})` : `rgb(${r},${g},${b})`;
}

// Paint values can be plain color strings or MapLibre expressions (e.g.
// ["interpolate",["linear"],["zoom"],9,"hsla(...)",12,"hsla(...)"]) —
// walk the whole structure and invert any leaf that looks like a color,
// leaving operators/property-references/numbers untouched.
function darkenValue(value: unknown): unknown {
  if (isColorLike(value)) return invertLightness(value);
  if (Array.isArray(value)) return value.map(darkenValue);
  return value;
}

export function darkenMapStyle(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    const props = PAINT_COLOR_PROPS[layer.type];
    if (!props) continue;
    const paint = (layer as { paint?: Record<string, unknown> }).paint ?? {};
    for (const prop of props) {
      if (!(prop in paint)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setPaintProperty(layer.id, prop as any, darkenValue(paint[prop]) as any);
    }
  }
}
