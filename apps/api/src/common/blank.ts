/** For optional text columns: a blank or whitespace-only value clears the field
 *  (stored as NULL), anything else is trimmed. `undefined` stays undefined so
 *  "not sent" still means "leave as is". */
export function blankToNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}
