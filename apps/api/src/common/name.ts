/**
 * Party-name normalization. Burmese letters can be typed multiple ways that look
 * identical but differ byte-for-byte (e.g. "ဦ" as ဥ+ီ vs the precomposed ဦ, or
 * differing sign order). Unicode NFC collapses these to one canonical form, so
 * the same name saved by two staff members ends up identical — which is what
 * makes search find it and stops duplicate customer records.
 */

/** Canonical STORED form of a name: Unicode NFC + trimmed. */
export function normalizeName(s: string): string {
  return s.normalize("NFC").trim();
}

/** Comparison key for dedup/search: NFC + lowercase + separators removed, so
 *  "B-204" / "B 204" / "B204" — and both byte-forms of a Burmese name — collapse
 *  to the same key. Burmese letters/digits are preserved. */
export function nameKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s._-]/g, "");
}

// ─── Loose matching (duplicate detection + forgiving search) ─────────────────
//
// Staff type the same customer many ways: with or without a title or a town in
// front, with tone marks dropped, with look-alike letters swapped. Spell-check
// does not work for Burmese names, so instead of correcting we compare on a key
// that ignores those differences, then score how much two keys overlap.

const COMPANY_WORDS = /\b(co|ltd|company|limited|pte|inc)\b/g;

/** Looser than nameKey: also drops punctuation, company words, tone marks that
 *  are often left out, and folds letters that are routinely confused. Only for
 *  comparing — never stored or shown. */
export function fuzzyKey(s: string): string {
  return (
    s
      .normalize("NFC")
      .toLowerCase()
      .replace(COMPANY_WORDS, "")
      .replace(/ကုမ္ပဏီ|လီမိတက်/g, "")
      // spaces, zero-width characters, punctuation (Latin and Burmese)
      .replace(/[\s​-‍﻿._,\-()\/'"·:;&+၊။]/g, "")
      .replace(/ြ/g, "ျ") // ya-yit vs ya-pin
      .replace(/ဉ/g, "ဥ") // nya vs u
      .replace(/၀/g, "ဝ") // digit zero typed for wa
      .replace(/[့း]/g, "") // dot-below and visarga are often dropped
      .replace(/(.)္\1/gu, "$1") // stacked double consonant (က္က) typed as one
      // the same character typed twice in a row (never digits: B11 is not B1)
      .replace(/([^0-9])\1+/gu, "$1")
  );
}

function bigrams(chars: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < chars.length - 1; i++) {
    const g = chars[i]! + chars[i + 1]!;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice overlap of character pairs, 0..1. */
function dice(a: string[], b: string[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const [g, n] of A) shared += Math.min(n, B.get(g) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/** Fewest single-character edits to turn `a` into `b`. */
function editDistance(a: string[], b: string[]): number {
  let prev = b.map((_, j) => j);
  prev.push(b.length);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Fewest edits to make `query` match SOME stretch of `text` (it may start and
 *  end anywhere in the text). */
function editDistanceWithin(query: string[], text: string[]): number {
  let prev = new Array<number>(text.length + 1).fill(0); // free start anywhere
  for (let i = 1; i <= query.length; i++) {
    const row = [i];
    for (let j = 1; j <= text.length; j++) {
      row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (query[i - 1] === text[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return Math.min(...prev); // free end anywhere
}

/** A name prepared once for repeated comparisons. */
export interface PreparedName {
  key: string;
  chars: string[];
  grams: Map<string, number>;
}
export function prepareName(s: string): PreparedName {
  const key = fuzzyKey(s);
  const chars = [...key];
  return { key, chars, grams: bigrams(chars) };
}

/** How much a character pair counts when comparing two names. */
export type GramWeights = (gram: string) => number;

/**
 * Weights learned from the whole customer list: a pair of characters that shows
 * up in many names (a town like လှိုင်သာယာ written in front of dozens of
 * customers, a title, a very common name) counts for little; a rare pair counts
 * for a lot. Without this, every customer from the same town looks alike.
 */
export function gramWeights(names: PreparedName[]): GramWeights {
  const df = new Map<string, number>();
  for (const n of names) for (const g of n.grams.keys()) df.set(g, (df.get(g) ?? 0) + 1);
  const total = Math.max(1, names.length);
  // Squared so a town shared by dozens of customers fades well below a pair
  // that belongs to one person's name.
  return (g) => Math.log(1 + total / (df.get(g) ?? 1)) ** 2;
}

/**
 * How well a typed query finds a name, 0..1. The query may sit ANYWHERE in the
 * name (a town or title written in front must not hide the person), and a slip
 * of a character or two still matches.
 */
export function searchScore(query: PreparedName, name: PreparedName): number {
  if (!query.key || !name.key) return 0;
  const at = name.key.indexOf(query.key);
  if (at === 0) return 1;
  if (at > 0) return 0.95;
  // Too short to forgive a typo — exact containment only.
  if (query.chars.length < 4) return 0;
  const edits = editDistanceWithin(query.chars, name.chars);
  return (1 - edits / query.chars.length) * 0.9;
}

/**
 * How likely two names are the same customer, 0..1. Equal keys = 1. Otherwise
 * the weighted overlap of their character pairs (order does not matter, so a
 * town written first or last still matches), or — when one name sits whole
 * inside the other — how much of the longer name's weight it covers.
 */
export function nameSimilarity(a: PreparedName, b: PreparedName, w: GramWeights = () => 1): number {
  if (!a.key || !b.key) return 0;
  if (a.key === b.key) return 1;
  const [short, long] = a.chars.length <= b.chars.length ? [a, b] : [b, a];
  if (short.chars.length < 3) return 0;
  // Codes like B21 / B218 differ exactly where it matters: the number.
  const numA = a.key.replace(/[^0-9]/g, "");
  const numB = b.key.replace(/[^0-9]/g, "");
  if ((numA || numB) && numA !== numB) return 0;

  let shared = 0;
  let wa = 0;
  let wb = 0;
  for (const [g, n] of a.grams) {
    const wt = w(g);
    wa += n * wt;
    shared += Math.min(n, b.grams.get(g) ?? 0) * wt;
  }
  for (const [g, n] of b.grams) wb += n * w(g);
  let score = wa + wb > 0 ? (2 * shared) / (wa + wb) : 0;
  if (short.chars.length >= 4 && long.key.includes(short.key)) {
    const ws = short === a ? wa : wb;
    const wl = short === a ? wb : wa;
    score = Math.max(score, 0.5 + 0.5 * (wl > 0 ? ws / wl : 0));
  }
  // Same name with a slip or two (မြဆန်း / မြစန်း): nearly identical end to end.
  if (short.chars.length >= 8) {
    const same = 1 - editDistance(a.chars, b.chars) / long.chars.length;
    if (same >= 0.85) score = Math.max(score, same);
  }
  return score;
}
