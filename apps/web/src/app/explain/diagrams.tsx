import type { ReactNode } from "react";
import { FX, METRICS, groups, visual, type Dir, type Metric } from "./content.my";

const DIR: Record<Dir, { mark: string; cls: string }> = {
  up: { mark: "▲", cls: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  down: { mark: "▼", cls: "border-rose-300 bg-rose-50 text-rose-800" },
  chg: { mark: "⇄", cls: "border-slate-300 bg-slate-100 text-slate-700" },
};
const ORDER: Metric[] = ["wh", "shop", "tl", "cash", "cust", "supp", "fee", "cost"];

/** Row of "what moves" chips for one action — the card's visual summary. */
export function FxChips({ id }: { id: string }) {
  const fx = FX[id];
  if (!fx) {
    return <span className="rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">⭕ {visual.noChange}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {ORDER.filter((m) => fx[m]).map((m) => {
        const d = DIR[fx[m] as Dir];
        return (
          <span key={m} className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${d.cls}`}>
            {METRICS[m].icon} {METRICS[m].label} {d.mark}
          </span>
        );
      })}
    </span>
  );
}

// ── Goods map ────────────────────────────────────────────────────
const INK = "#334155";
const LINE = "#94a3b8";

function Node({ x, y, w, h, label, fill, stroke, sub }: { x: number; y: number; w: number; h: number; label: string; fill: string; stroke: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} stroke={stroke} strokeWidth={2} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 6)} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 18} textAnchor="middle" fontSize={11} fill="#64748b">
          {sub}
        </text>
      )}
    </g>
  );
}

/** A clickable action label sitting on an arrow; jumps to that action's card. */
function Act({ x, y, href, children }: { x: number; y: number; href: string; children: ReactNode }) {
  return (
    <a href={href}>
      <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={600} fill="#1d4ed8" textDecoration="underline">
        {children}
      </text>
    </a>
  );
}

export function GoodsMap() {
  const m = visual.map;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption>
        <h2 className="text-xl font-bold">{m.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.note}</p>
      </figcaption>
      <div className="overflow-x-auto rounded-2xl border bg-white p-2">
        <svg viewBox="0 0 760 330" role="img" aria-label={m.title} className="h-auto w-full min-w-[640px]">
          <defs>
            <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={LINE} />
            </marker>
          </defs>

          {/* in-place work on the warehouse */}
          <rect x={205} y={14} width={190} height={62} rx={10} fill="#f8fafc" stroke="#cbd5e1" strokeDasharray="5 4" />
          <Act x={252} y={40} href="#cut">{m.cut}</Act>
          <Act x={346} y={40} href="#wash">{m.wash}</Act>
          <text x={300} y={62} textAnchor="middle" fontSize={11} fill="#64748b">{m.inPlace}</text>
          <path d="M300 76 L300 104" stroke={LINE} strokeWidth={2} strokeDasharray="4 3" markerEnd="url(#ah)" markerStart="url(#ah)" fill="none" />

          <Node x={20} y={115} w={120} h={70} label={m.supplier} fill="#f1f5f9" stroke="#cbd5e1" />
          <Node x={225} y={108} w={150} h={84} label={m.warehouse} fill="#ecfdf5" stroke="#34d399" />
          <Node x={225} y={258} w={150} h={58} label={m.tailor} fill="#fef3c7" stroke="#fbbf24" />
          <Node x={470} y={115} w={120} h={70} label={m.shop} fill="#ecfdf5" stroke="#34d399" />
          <Node x={655} y={115} w={90} h={70} label={m.customer} fill="#f1f5f9" stroke="#cbd5e1" />

          {/* supplier → warehouse */}
          <path d="M140 150 L223 150" stroke={LINE} strokeWidth={2} markerEnd="url(#ah)" fill="none" />
          <Act x={182} y={140} href="#order-receive">{m.receive}</Act>

          {/* warehouse ⇄ tailor */}
          <path d="M270 192 L270 256" stroke={LINE} strokeWidth={2} markerEnd="url(#ah)" fill="none" />
          <path d="M330 258 L330 194" stroke={LINE} strokeWidth={2} markerEnd="url(#ah)" fill="none" />
          <Act x={212} y={230} href="#tailor-send">{m.send}</Act>
          <Act x={388} y={230} href="#tailor-receive">{m.back}</Act>

          {/* warehouse → shop */}
          <path d="M375 150 L468 150" stroke={LINE} strokeWidth={2} markerEnd="url(#ah)" fill="none" />
          <Act x={422} y={140} href="#transfer">{m.transfer}</Act>

          {/* shop → customer, and returns back */}
          <path d="M590 138 L653 138" stroke={LINE} strokeWidth={2} markerEnd="url(#ah)" fill="none" />
          <Act x={622} y={128} href="#sell-new">{m.sell}</Act>
          <path d="M655 166 L592 166" stroke={LINE} strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#ah)" fill="none" />
          <Act x={622} y={186} href="#sell-return">{m.ret}</Act>
        </svg>
      </div>
    </figure>
  );
}

// ── Cash drawer formula ──────────────────────────────────────────
function Box({ tone, title, sub, items, sign }: { tone: "plain" | "in" | "out" | "result"; title: string; sub?: string; items?: string[]; sign?: string }) {
  const cls = {
    plain: "border-slate-200 bg-card",
    in: "border-emerald-300 bg-emerald-50 text-emerald-950",
    out: "border-rose-300 bg-rose-50 text-rose-950",
    result: "border-blue-300 bg-blue-50 text-blue-950",
  }[tone];
  return (
    <div className={`flex-1 rounded-2xl border-2 p-3 ${cls}`}>
      <p className="text-base font-bold">
        {sign && <span className="mr-1">{sign}</span>}
        {title}
      </p>
      {sub && <p className="text-xs opacity-80">{sub}</p>}
      {items && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm leading-snug">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
const Op = ({ children }: { children: ReactNode }) => (
  <span aria-hidden className="self-center text-2xl font-bold text-muted-foreground">{children}</span>
);

export function CashFormula() {
  const c = visual.cashbox;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption>
        <h2 className="text-xl font-bold">{c.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.note}</p>
      </figcaption>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <Box tone="plain" title={c.opening} sub={c.openingSub} />
        <Op>+</Op>
        <Box tone="in" title={c.plus} items={c.plusItems} />
        <Op>−</Op>
        <Box tone="out" title={c.minus} items={c.minusItems} />
        <Op>=</Op>
        <Box tone="result" title={c.expected} sub={c.expectedSub} />
        <Op>→</Op>
        <Box tone="plain" title={c.keep} sub={c.keepSub} />
      </div>
      <p className="rounded-xl border border-dashed px-3 py-2 text-sm">
        <span className="font-semibold">{c.bank}</span> — <span className="text-muted-foreground">{c.bankSub}</span>
      </p>
    </figure>
  );
}

// ── Action × effect matrix ───────────────────────────────────────
export function EffectMatrix() {
  const x = visual.matrix;
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption>
        <h2 className="text-xl font-bold">{x.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{x.note}</p>
      </figcaption>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th className="sticky left-0 z-10 min-w-[9.5rem] bg-card p-2 text-left font-medium text-muted-foreground">{x.action}</th>
              {ORDER.map((m) => (
                <th key={m} className="min-w-[4.5rem] p-2 text-center font-medium">
                  <span className="block text-base">{METRICS[m].icon}</span>
                  <span className="block leading-tight text-muted-foreground">{METRICS[m].label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = g.cards.filter((c) => FX[c.id]);
              if (rows.length === 0) return null;
              return [
                <tr key={g.id} className="border-b bg-muted/50">
                  <th colSpan={ORDER.length + 1} className="sticky left-0 p-2 text-left text-xs font-semibold text-muted-foreground">
                    {g.title}
                  </th>
                </tr>,
                ...rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium">
                      <a href={`#${c.id}`} className="underline decoration-dotted">{c.title}</a>
                    </th>
                    {ORDER.map((m) => {
                      const d = FX[c.id][m];
                      return (
                        <td key={m} className="p-1 text-center">
                          {d && (
                            <span
                              title={`${METRICS[m].label} ${visual.dir[d]}`}
                              className={`inline-block w-9 rounded-md border py-0.5 text-sm font-bold ${DIR[d].cls}`}
                            >
                              {DIR[d].mark}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
