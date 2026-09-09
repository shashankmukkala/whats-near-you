#!/usr/bin/env node
/**
 * Turns the research spreadsheet into a reviewable seed file.
 *
 *   node scripts/parse-sheet.mjs "Ganesh Pandals - Sheet2.csv"
 *
 * Writes scripts/seed-pandals.json and prints a report of what it kept,
 * what it changed, and what it refused. The two steps are deliberately
 * separate — this one is pure and offline, so the output can be read and
 * corrected before scripts/seed-pandals.mjs ever touches the database.
 *
 * Why a report at all: in the project this is adapted from, seeded
 * coordinates came from an untraced source and only 16 of 85 matched the
 * CSV they supposedly came from. Nobody noticed for months because the
 * import printed nothing. Every transformation below is therefore either
 * announced or refused.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "seed-pandals.json");

const SEASON = "ganesh-2026";
// Confirmed by the operator: every pandal in this sheet opens on 14 Sep
// 2026. Immersion is per-row (all currently 25 Sep, but the column is
// read rather than assumed, because in most years they differ).
const SEASON_STARTS_AT = "2026-09-14T00:00:00+05:30";
const FALLBACK_ENDS_AT = "2026-09-25T23:59:59+05:30";

// Matches lib/mapStyle.ts's TELANGANA_BOUNDS, widened slightly — the same
// range the places_coords_check constraint enforces in migration 0002.
const BOUNDS = { minLng: 77.0, maxLng: 81.6, minLat: 15.6, maxLat: 20.3 };

/** RFC 4180: quoted fields may contain commas, quotes ("" escapes) and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Two rows in the sheet carry coordinates as degrees-minutes-seconds
 * (17°26'02.7"N) rather than decimal. Left unconverted, parseFloat reads
 * them as 17 and 78 — a point in the Arabian Sea, which the CHECK
 * constraint would reject but a looser schema would happily store.
 */
function parseCoordinate(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { value: null, source: null };

  const dms = value.match(/^(\d+)[°º]\s*(\d+)['′]\s*([\d.]+)\s*["″]?\s*([NSEW])$/i);
  if (dms) {
    const [, deg, min, sec, hemi] = dms;
    let decimal = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    if (/[SW]/i.test(hemi)) decimal = -decimal;
    return { value: Number(decimal.toFixed(7)), source: "sheet-dms" };
  }

  const decimal = Number(value);
  if (!Number.isFinite(decimal)) return { value: null, source: null };
  // The sheet's decimal coordinates carry 8 decimal places, which is
  // millimetre precision no phone or geocoder actually produces. Rounded
  // to 7 (about a centimetre) so the stored value does not imply an
  // accuracy the source never had.
  return { value: Number(decimal.toFixed(7)), source: "sheet-decimal" };
}

/**
 * "Road No. 3, Warasiguda, Secunderabad" -> "Warasiguda".
 *
 * The sheet has one column doing the work of three (address, area, city),
 * and the area is what the map filters and searches on. The city is
 * dropped when something more specific survives, and of what remains the
 * LAST segment wins — "Road No. 3" is a street inside Warasiguda, not the
 * locality anyone would search for.
 *
 * Spellings are left exactly as the sheet has them ("Subash Road",
 * "Jubliee Bus Stand"). Silently correcting a proper noun during an
 * import is how a dataset and its source stop agreeing; the report flags
 * them instead so they can be fixed at the source.
 */
const CITY_WORDS = new Set(["hyderabad", "secunderabad"]);
function deriveArea(address) {
  const segments = String(address ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  const withoutCity = segments.filter((s) => !CITY_WORDS.has(s.toLowerCase()));
  const pool = withoutCity.length > 0 ? withoutCity : segments;
  return pool[pool.length - 1];
}

/** "9/25/2026" -> end of that day in IST. */
function immersionToEndsAt(raw) {
  const value = String(raw ?? "").trim();
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, month, day, year] = m;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T23:59:59+05:30`;
}

function clean(value) {
  const trimmed = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed ? trimmed : null;
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/parse-sheet.mjs "Ganesh Pandals - Sheet2.csv"');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const header = rows[0].map((h) => h.trim());
  const col = (name) => {
    const index = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (index === -1) throw new Error(`Column not found in sheet: ${name}`);
    return index;
  };

  const COL = {
    name: col("Pandal Name"),
    address: col("Address / Area / Locality"),
    knownFor: col("Known For"),
    theme: col("Concept/Theme"),
    immersion: col("Immersion Date"),
    verified: col("Source/Verified Status"),
    maps: col("Google Maps Link"),
    lat: col("Latitude"),
    lng: col("Longitude"),
    media: col("Photos/Video/Reel link"),
  };

  const kept = [];
  const skipped = [];
  const notes = [];

  for (const row of rows.slice(1)) {
    const name = clean(row[COL.name]);
    if (!name) continue; // blank spacer rows at the bottom of the sheet

    const address = clean(row[COL.address]);
    // The tail of the sheet has coverage notes shaped like records —
    // "Begum Bazar, 5" — where the second column is a count, not an
    // address. They have no coordinates, so the check below catches them,
    // but naming the shape here keeps the skip list readable.
    const lat = parseCoordinate(row[COL.lat]);
    const lng = parseCoordinate(row[COL.lng]);

    if (lat.value === null || lng.value === null) {
      skipped.push({ name, reason: "no usable coordinates in the sheet" });
      continue;
    }
    if (
      lng.value < BOUNDS.minLng ||
      lng.value > BOUNDS.maxLng ||
      lat.value < BOUNDS.minLat ||
      lat.value > BOUNDS.maxLat
    ) {
      skipped.push({ name, reason: `coordinate outside Telangana: ${lat.value}, ${lng.value}` });
      continue;
    }
    if (lat.source === "sheet-dms" || lng.source === "sheet-dms") {
      notes.push(`${name}: converted DMS coordinates -> ${lat.value}, ${lng.value}`);
    }

    const area = deriveArea(address);
    if (area && /jubliee|subash/i.test(area)) {
      notes.push(`${name}: area "${area}" looks misspelled in the sheet — kept verbatim, fix at the source`);
    }

    const endsAt = immersionToEndsAt(row[COL.immersion]);
    if (!endsAt) notes.push(`${name}: no immersion date in the sheet — defaulted to 25 Sep 2026`);

    kept.push({
      name,
      area,
      address,
      known_for: clean(row[COL.knownFor]),
      theme: clean(row[COL.theme]),
      maps_url: clean(row[COL.maps]),
      media_url: clean(row[COL.media]),
      image_url: null,
      tags: [],
      lng: lng.value,
      lat: lat.value,
      // Recorded per row rather than assumed: provenance is what made the
      // reference project's bad pins impossible to audit after the fact.
      coord_source: lat.source === "sheet-dms" || lng.source === "sheet-dms" ? "sheet-dms" : "sheet-decimal",
      starts_at: SEASON_STARTS_AT,
      ends_at: endsAt ?? FALLBACK_ENDS_AT,
      season: SEASON,
      // Internal research field — stored, never served publicly. See the
      // column grants in migration 0002.
      verification_status: clean(row[COL.verified])?.toLowerCase() ?? null,
    });
  }

  // Two Ram Nagar pandals in the sheet sit about two metres apart, which
  // is a data question, not an import error — flagged rather than merged.
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const metres = Math.hypot((kept[i].lat - kept[j].lat) * 111_320, (kept[i].lng - kept[j].lng) * 105_000);
      if (metres < 25) {
        notes.push(`${kept[i].name} and ${kept[j].name} are ${metres.toFixed(0)}m apart — their pins will overlap`);
      }
    }
  }

  fs.writeFileSync(OUT, `${JSON.stringify(kept, null, 2)}\n`);

  console.log(`\nParsed ${csvPath}`);
  console.log(`  kept    ${kept.length} pandals -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`  skipped ${skipped.length}`);
  for (const s of skipped) console.log(`            - ${s.name}: ${s.reason}`);
  if (notes.length) {
    console.log(`\n  notes:`);
    for (const n of notes) console.log(`            - ${n}`);
  }
  const areas = [...new Set(kept.map((k) => k.area).filter(Boolean))].sort();
  console.log(`\n  areas (${areas.length}): ${areas.join(", ")}\n`);
}

main();
