/**
 * Emits a full English ↔ current-Burmese review table (Markdown) so a native
 * speaker can QA/correct every string. Writes to i18n-review.md at the repo root.
 *   pnpm --filter @lgy/db exec tsx apps/web/scripts/i18n-table.ts
 */
import { writeFileSync } from "node:fs";
import { en } from "../src/lib/labels.en";
import { my } from "../src/lib/labels.my";

type AnyObj = Record<string, unknown>;

const rows: { section: string; path: string; en: string; my: string }[] = [];

function get(obj: AnyObj | undefined, keys: string[]): unknown {
  return keys.reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as AnyObj)[k] : undefined), obj);
}

function walk(e: AnyObj, trail: string[]) {
  for (const key of Object.keys(e)) {
    const ev = e[key];
    if (typeof ev === "function") continue;
    if (ev && typeof ev === "object") {
      walk(ev as AnyObj, [...trail, key]);
    } else if (typeof ev === "string") {
      const path = [...trail, key].join(".");
      const mv = get(my as AnyObj, [...trail, key]);
      rows.push({
        section: trail[0] ?? "(root)",
        path,
        en: ev,
        my: typeof mv === "string" ? mv : "",
      });
    }
  }
}
walk(en as AnyObj, []);

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

let out = "# LGY i18n review — English ↔ Burmese\n\n";
out += "Correct the **Burmese** column where the wording is off, then hand it back.\n\n";

let section = "";
for (const r of rows) {
  if (r.section !== section) {
    section = r.section;
    out += `\n## ${section}\n\n| Key | English | Burmese (correct here) |\n| --- | --- | --- |\n`;
  }
  out += `| \`${r.path}\` | ${esc(r.en)} | ${esc(r.my)} |\n`;
}

writeFileSync(new URL("../../../i18n-review.md", import.meta.url), out);
console.log(`Wrote i18n-review.md — ${rows.length} strings across ${new Set(rows.map((r) => r.section)).size} sections.`);
