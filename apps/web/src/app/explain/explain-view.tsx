"use client";

import { useMemo, useState } from "react";
import { TAGS, WHO, flow, gaps, groups, page, rules, undoHead, undoTable, type Card } from "./content.my";

const WHO_STYLE: Record<Card["who"], string> = {
  staff: "bg-emerald-100 text-emerald-900",
  both: "bg-emerald-100 text-emerald-900",
  admin: "bg-slate-200 text-slate-900",
};

/** Everything searchable on a card, flattened once. */
function haystack(c: Card): string {
  return [c.title, c.where, ...c.does, ...c.links.map((l) => l[1]), c.undo ?? "", ...(c.careful ?? [])]
    .join(" ")
    .toLowerCase();
}

export function ExplainView() {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const indexed = useMemo(
    () => groups.map((g) => ({ ...g, cards: g.cards.map((c) => ({ card: c, text: haystack(c) })) })),
    [],
  );
  const shown = indexed
    .map((g) => ({ ...g, cards: needle ? g.cards.filter((c) => c.text.includes(needle)) : g.cards }))
    .filter((g) => g.cards.length > 0);

  return (
    <div className="flex flex-col gap-10">
      {/* Big picture */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{flow.title}</h2>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{flow.goods.title}</h3>
          <ol className="flex flex-wrap items-stretch gap-2">
            {flow.goods.steps.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2">
                <div className="rounded-xl border bg-card px-3 py-2">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
                {i < flow.goods.steps.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{flow.money.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
              <p className="font-semibold">＋ {flow.money.inLabel}</p>
              <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
                {flow.money.in.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950">
              <p className="font-semibold">－ {flow.money.outLabel}</p>
              <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
                {flow.money.out.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{flow.money.note}</p>
        </div>
      </section>

      {/* Rules */}
      <section className="flex flex-col gap-3">
        {rules.map((r) => (
          <details key={r.title} className="rounded-2xl border bg-card p-4" open>
            <summary className="cursor-pointer text-base font-bold">{r.title}</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
              {r.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      {/* Legend + search + contents */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{page.legend}</h2>
        <p className="text-sm text-muted-foreground">{page.legendNote}</p>
        <ul className="flex flex-wrap gap-2 text-sm">
          {Object.entries(TAGS).map(([k, v]) => (
            <li key={k} className="rounded-full border bg-card px-3 py-1">
              {v.icon} {v.label}
            </li>
          ))}
        </ul>
        <input
          id="explain-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={page.search}
          aria-label={page.search}
          className="mt-2 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        {!needle && (
          <nav aria-label={page.toc} className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">{page.toc}</p>
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="font-semibold underline">
                    {g.title}
                  </a>
                  <span className="text-muted-foreground"> — {g.cards.map((c) => c.title).join("၊ ")}</span>
                </li>
              ))}
              <li>
                <a href="#undo" className="font-semibold underline">{undoHead.title}</a>
              </li>
              <li>
                <a href="#gaps" className="font-semibold underline">{gaps.title}</a>
              </li>
            </ul>
          </nav>
        )}
      </section>

      {shown.length === 0 && <p className="rounded-xl border p-6 text-center text-muted-foreground">{page.noMatch}</p>}

      {shown.map((g) => (
        <section key={g.id} id={g.id} className="flex scroll-mt-4 flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">{g.title}</h2>
            {g.intro && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.intro}</p>}
          </div>
          {g.cards.map(({ card: c }) => (
            <article key={c.id} id={c.id} className="scroll-mt-4 rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg font-bold">{c.title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${WHO_STYLE[c.who]}`}>{WHO[c.who]}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{c.where}</p>

              <h4 className="mt-4 text-sm font-semibold text-muted-foreground">{page.h.does}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                {c.does.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>

              <h4 className="mt-4 text-sm font-semibold text-muted-foreground">{page.h.links}</h4>
              <ul className="mt-1 flex flex-col gap-1.5">
                {c.links.map(([tag, text], i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr] items-start gap-2 leading-relaxed">
                    <span className="mt-0.5 whitespace-nowrap rounded-full border bg-background px-2 py-0.5 text-xs">
                      {TAGS[tag].icon} {TAGS[tag].label}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              {c.undo && (
                <>
                  <h4 className="mt-4 text-sm font-semibold text-muted-foreground">{page.h.undo}</h4>
                  <p className="mt-1 leading-relaxed">{c.undo}</p>
                </>
              )}

              {c.careful && c.careful.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <h4 className="text-sm font-semibold">⚠ {page.h.careful}</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
                    {c.careful.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </section>
      ))}

      {!needle && (
        <>
          <section id="undo" className="flex scroll-mt-4 flex-col gap-3">
            <h2 className="text-xl font-bold">{undoHead.title}</h2>
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-2.5">{undoHead.action}</th>
                    <th className="p-2.5">{undoHead.how}</th>
                    <th className="p-2.5">{undoHead.who}</th>
                    <th className="p-2.5">{undoHead.notReversed}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {undoTable.map((r) => (
                    <tr key={r.action} className="align-top">
                      <td className="p-2.5 font-medium">{r.action}</td>
                      <td className="p-2.5">{r.how}</td>
                      <td className="whitespace-nowrap p-2.5">{r.who}</td>
                      <td className="p-2.5 text-muted-foreground">{r.notReversed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="gaps" className="flex scroll-mt-4 flex-col gap-3">
            <h2 className="text-xl font-bold">{gaps.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{gaps.note}</p>
            <ul className="list-disc space-y-1.5 rounded-2xl border bg-card p-4 pl-9 leading-relaxed">
              {gaps.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
