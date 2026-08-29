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
