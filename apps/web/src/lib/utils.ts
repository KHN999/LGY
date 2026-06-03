import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { labels } from "./labels";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKyat(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount) + " " + labels.units.kyat;
}

// All dates in the system are stored as UTC instants. These formatters pin the
// display to Myanmar time (+06:30) explicitly, so a date reads the same whether
// it's rendered on the server (Railway, UTC) or in any browser, anywhere.
const YANGON_TZ = "Asia/Yangon";

/** DD/MM/YYYY in Myanmar time. */
export function formatDate(d: string | number | Date): string {
  return new Date(d).toLocaleDateString("en-GB", { timeZone: YANGON_TZ });
}

/** DD/MM/YYYY, HH:mm in Myanmar time. */
export function formatDateTime(d: string | number | Date): string {
  return new Date(d).toLocaleString("en-GB", {
    timeZone: YANGON_TZ,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** YYYY-MM-DD in Myanmar time — for bucketing rows into calendar days. */
export function yangonYmd(d: string | number | Date): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: YANGON_TZ });
}
