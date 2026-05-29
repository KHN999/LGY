/**
 * Yangon timezone helpers. All date math anchors to +06:30.
 * Server timezone could be anything (UTC on Railway); these helpers do the work.
 */

export const YANGON_OFFSET_MIN = 390;

/** YYYY-MM-DD in Yangon for a given Date. */
export function toYangonYmd(d: Date): string {
  const shifted = new Date(d.getTime() + YANGON_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Yangon midnight (UTC equivalent) for a given Yangon YYYY-MM-DD. */
export function ymdToYangonStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+06:30`);
}

/** Add days to a Date. */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Start of "today" in Yangon. */
export function startOfTodayYangon(now: Date = new Date()): Date {
  return ymdToYangonStart(toYangonYmd(now));
}
