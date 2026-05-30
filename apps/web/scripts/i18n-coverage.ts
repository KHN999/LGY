/**
 * i18n coverage report: compares labels.en (source of truth) against labels.my
 * and lists every English string not yet translated to Burmese.
 *   pnpm --filter @lgy/db exec tsx apps/web/scripts/i18n-coverage.ts
 */
import { en } from "../src/lib/labels.en";
import { my } from "../src/lib/labels.my";

type AnyObj = Record<string, unknown>;
const hasBurmese = (s: string) => /[က-႟]/.test(s);

const missing: { path: string; en: string }[] = [];
const stillLatin: { path: string; value: string }[] = [];
const functions: string[] = [];

function walk(e: AnyObj, m: AnyObj | undefined, trail: string[]) {
  for (const key of Object.keys(e)) {
    const ev = e[key];
    const mv = m?.[key];
    const path = [...trail, key].join(".");

    if (typeof ev === "function") {
      functions.push(path);
    } else if (ev && typeof ev === "object") {
      walk(ev as AnyObj, (mv ?? undefined) as AnyObj | undefined, [...trail, key]);
    } else if (typeof ev === "string") {
      if (typeof mv !== "string") {
        missing.push({ path, en: ev });
      } else if (!hasBurmese(mv)) {
        stillLatin.push({ path, value: mv });
      }
    }
  }
}

walk(en as AnyObj, my as AnyObj, []);

const totalStrings = (function count(o: AnyObj): number {
  let n = 0;
  for (const v of Object.values(o)) {
    if (typeof v === "string") n++;
    else if (v && typeof v === "object") n += count(v as AnyObj);
  }
  return n;
})(en as AnyObj);

console.log(`\n=== UNTRANSLATED (fall back to English in the Burmese UI): ${missing.length} ===`);
let section = "";
for (const { path, en: text } of missing) {
  const top = path.split(".")[0];
  if (top !== section) {
    section = top;
    console.log(`\n[${section}]`);
  }
  console.log(`  ${path}  →  "${text}"`);
}

console.log(`\n\n=== PRESENT BUT STILL LATIN (review — may be intentional brand/codes): ${stillLatin.length} ===`);
for (const { path, value } of stillLatin) console.log(`  ${path}  =  "${value}"`);

console.log(`\n\n=== FUNCTION-VALUED (voice/dynamic strings): ${functions.length} ===`);
for (const p of functions) console.log(`  ${p}`);

console.log(
  `\n\nSummary: ${totalStrings} source strings · ${missing.length} untranslated · ${stillLatin.length} latin · ${functions.length} functions`,
);
