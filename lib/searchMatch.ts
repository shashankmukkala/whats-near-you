import type { Place } from "@/lib/supabase";
import { isLiveNow } from "@/lib/season";


// Handles compound, typo-tolerant queries like "work friendly in jublie
// hills" — a vibe/tag AND a (misspelled) area in the same search. The
// earlier version checked the whole query string against each tag/
// category/location in turn and stopped at the first hit, so a query
// combining two criteria only ever matched one of them (or neither, if
// the combined string didn't substring-match anything).  This instead:
// tokenizes the query into words, drops filler words ("in", "near", ...),
// fuzzy-matches (typo-tolerant) each word against tag/category/location
// vocabulary, and combines every criterion it finds (AND, not first-wins)
// into one filter.

const STOPWORDS = new Set(["in", "at", "near", "around", "the", "a", "an", "of", "for", "with"]);

/**
 * Folds accents to their base letters: "Conçu" -> "concu", "Lé" -> "le",
 * "Nommè" -> "nomme".
 *
 * Without this the tokenizer's `[^a-z0-9\s]` replacement turned every
 * accented letter into a *space*, splitting one word into fragments —
 * "conçu" became the two tokens "con" and "u". That broke the cafe in two
 * ways at once: nobody typing "concu" on an English keyboard could find
 * it, and the stray one-letter token went on to match unrelated
 * vocabulary. Three of the 85 cafes carry accents.
 */
export function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(text: string): string[] {
  return foldAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Exact match, PREFIX match (handles plurals/short forms — "cafe" vs
// "cafes"), or a small edit-distance allowance scaled to word length
// (typo tolerance without being so loose that unrelated short words
// collide). "jublie" -> "jubilee" is a real example the edit-distance
// tolerance needs to catch: a dropped letter plus a transposition is
// edit-distance 2 even though it reads as an obvious one-word typo, so
// the threshold is keyed off the longer of the two words (not the
// shorter) — a short query word shouldn't get less tolerance just because
// the dictionary word it's matching against is long.
//
// The length cutoff for allowing that distance-2 tolerance is 6, not 5:
// "buffet" and "budget" are both real vocabulary (a category and a tag),
// both 6 letters, and are genuinely edit-distance 2 apart (two
// substitutions) — with the cutoff at 5 they satisfied "6 > 5" and
// silently matched each other, so searching "best buffet" quietly added
// a "💰 Budget" tag filter nobody asked for and zeroed out the results.
// Moving the cutoff to 6 excludes that pair (needs distance ≤1 at that
// length) while still covering jublie/jubilee (7 letters, > 6).
//
// Prefix-only, not "contains anywhere": an earlier version used
// `a.includes(b) || b.includes(a)`, which matched "pet" inside
// "gandiPET" and silently added "📍 Gandipet" to a "pet friendly" search
// that never mentioned Gandipet at all — a real false positive from that
// codebase, not a hypothetical one. Prefix containment still catches the
// legitimate plural/truncation cases ("cafe" -> "cafes") without matching
// a short word buried inside an unrelated longer one.
// The prefix rule needs its own floor. The length guard below sits *after*
// the prefix check, so a one-letter token prefix-matched anything starting
// with that letter: "u" matched the area "Uppal", "b" matched "Bakery",
// "c" matched "Cafe". That is how searching "conçu" — which tokenized to
// "con" + "u" — flew the map to Uppal, a different part of the city from
// the cafe being searched for. Three characters is the shortest prefix
// that carries real intent; "cafe" -> "cafes" and other plural or
// truncation cases are all longer than that.
const MIN_PREFIX_MATCH_LENGTH = 3;

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter >= MIN_PREFIX_MATCH_LENGTH && (a.startsWith(b) || b.startsWith(a))) return true;
  if (a.length < 4 || b.length < 4) return false;
  const maxDist = Math.max(a.length, b.length) <= 6 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

function overlapScore(candidateWords: string[], queryTokens: string[]): number {
  return candidateWords.filter((cw) => queryTokens.some((qt) => wordsMatch(cw, qt))).length;
}

// "live", "now", "today", "tonight", "open" all express the same intent —
// show me what is actually standing right now — which on a festival map
// is the single most common thing anyone wants. Handled here rather than
// only as a filter chip so that typing it works as well as tapping it.
//
// This replaces the reference project's "best/top" rating handling. There
// is no rating in this product to narrow by, and there deliberately never
// will be: a pandal is not scored out of five.
const LIVE_WORDS = new Set(["live", "now", "today", "tonight", "open", "ongoing", "currently"]);

// Words that appear in so many Hyderabad locality names that matching one
// of them alone tells you nothing — "road" is in both RP Road and Subhash
// Road, "nagar" is in Ram Nagar and half the city besides. A single-token
// area match is only trusted when the token that matched is NOT one of
// these (see the area matching block below).
const GENERIC_AREA_WORDS = new Set([
  "road", "nagar", "bus", "stand", "stop", "colony", "street", "cross",
  "roads", "old", "new", "east", "west", "north", "south", "hyderabad",
  "secunderabad", "no",
]);

export type SearchGroupMatch = { label: string; places: Place[] } | null;

/**
 * Resolves a free-text query into a filter over the loaded places.
 *
 * Vocabularies are passed in rather than imported from a constants file,
 * because they are derived from the rows themselves (see
 * lib/vocabulary.ts) — a hardcoded list is exactly what silently stopped
 * matching the data in the project this is adapted from.
 *
 * Every criterion found is ANDed, so "live pandals in ram nagar" resolves
 * to Live now + Ram Nagar rather than stopping at the first hit.
 */
export function matchSearchGroup(query: string, places: Place[], tagVocabulary: string[] = []): SearchGroupMatch {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;

  const tagMatch = tagVocabulary.find((tag) => {
    const words = tokenize(tag);
    return words.length > 0 && overlapScore(words, tokens) === words.length;
  });

  const wantsLiveNow = tokens.some((t) => LIVE_WORDS.has(t));

  // Area matching, with the reference's known limitation fixed.
  //
  // There, the threshold was `min(2, words.length)`, so a two-word area
  // needed BOTH words present — "jubilee" alone never matched "Jubilee
  // Hills", which affected the two largest neighbourhoods in the dataset.
  // Here most areas are two words ("Ram Nagar", "Old Bhoiguda", "RP
  // Road"), so the same bug would affect almost everything.
  //
  // The fix is not simply to lower the threshold to 1: that makes "road"
  // match whichever of RP Road / Subhash Road happens to be first. So a
  // full match (every word present) always wins, and a single-word match
  // counts only when the word carries real information — not a generic
  // locality word — AND is unambiguous, meaning exactly one area in the
  // data matched that way. Two areas tying on one distinctive token is
  // treated as no area match at all rather than a coin flip that yanks
  // the map somewhere the user did not ask for.
  const areas = [...new Set(places.map((p) => p.area).filter((a): a is string => !!a))];
  let areaMatch: string | undefined;
  let bestScore = 0;
  const distinctiveSingles: string[] = [];

  for (const area of areas) {
    const words = tokenize(area);
    if (words.length === 0) continue;
    const score = overlapScore(words, tokens);

    if (score === words.length && score > bestScore) {
      areaMatch = area;
      bestScore = score;
      continue;
    }
    if (score >= 1) {
      const matchedDistinctive = words.some(
        (w) => !GENERIC_AREA_WORDS.has(w) && w.length >= 4 && tokens.some((t) => wordsMatch(w, t))
      );
      if (matchedDistinctive) distinctiveSingles.push(area);
    }
  }
  if (!areaMatch && distinctiveSingles.length === 1) areaMatch = distinctiveSingles[0];

  if (!tagMatch && !areaMatch && !wantsLiveNow) return null;

  let result = places;
  const labelParts: string[] = [];

  if (wantsLiveNow) {
    result = result.filter((p) => isLiveNow(p));
    labelParts.push("Live now");
  }
  if (tagMatch) {
    result = result.filter((p) => p.tags.includes(tagMatch));
    labelParts.push(tagMatch);
  }
  if (areaMatch) {
    result = result.filter((p) => p.area === areaMatch);
    labelParts.push(areaMatch);
  }

  return { label: labelParts.join(" · "), places: result };
}
