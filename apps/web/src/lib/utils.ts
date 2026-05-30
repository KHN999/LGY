import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { labels } from "./labels";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKyat(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount) + " " + labels.units.kyat;
}
