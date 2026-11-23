"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type DuplicateGroup } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatDate, formatKyat } from "@/lib/utils";
import { Button, Card, EmptyState } from "@/components/ui";

const L = labels.dup;
type Tab = "all" | "exact" | "similar";
type Member = DuplicateGroup["members"][number];

export function DuplicateGroups({ groups }: { groups: DuplicateGroup[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const shown = groups.filter((g) => (tab === "all" ? true : tab === "exact" ? g.exact : !g.exact));
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: L.tabAll, count: groups.length },
    { key: "exact", label: L.tabExact, count: groups.filter((g) => g.exact).length },
    { key: "similar", label: L.tabSimilar, count: groups.filter((g) => !g.exact).length },
  ];
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-semibold " +
              (tab === t.key ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
            }
          >
            {t.label} <span className="tabular-nums opacity-70">{t.count}</span>
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <EmptyState>{L.allDone}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {shown.map((g) => (
            // Keyed by its members, so a group re-mounts (fresh choices) once a
            // merge or dismissal changes who is in it.
            <GroupCard key={g.members.map((m) => m.id).join("-")} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberTile({
  m,
  state,
  maxSales,
  onKeep,
  onToggle,
}: {
  m: Member;
  state: "keep" | "merge" | "left";
  maxSales: number;
  onKeep: () => void;
  onToggle: () => void;
}) {
  const tone =
    state === "keep"
      ? "border-2 border-emerald-500 bg-emerald-50"
      : state === "merge"
        ? "border-2 border-dashed border-amber-400 bg-amber-50/60"
        : "border opacity-55";
  return (
    <div className={"flex min-w-0 flex-col gap-2 rounded-2xl p-3 " + tone}>
      <span
        className={
          "self-start rounded-full px-2 py-0.5 text-xs font-semibold " +
          (state === "keep"
            ? "bg-emerald-600 text-white"
            : state === "merge"
              ? "bg-amber-200 text-amber-900"
              : "bg-muted text-muted-foreground")
        }
      >
        {state === "keep" ? `✓ ${L.kept}` : state === "merge" ? `→ ${L.willMerge}` : L.leftOut}
      </span>
      <Link href={`/admin/customers/${m.id}`} className="break-words text-lg font-bold leading-snug hover:underline">
        {m.name}
      </Link>
      <p className="text-xs tabular-nums text-muted-foreground">
        #{m.id}
        {m.contact ? ` · 📞 ${m.contact}` : ""}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="tabular-nums">
            🧾 {m.salesCount} {L.sales}
          </span>
          <span className="text-xs text-muted-foreground">
            {m.lastSaleAt ? formatDate(m.lastSaleAt) : L.noSales}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#2a78d6]"
            style={{ width: `${maxSales > 0 ? (m.salesCount / maxSales) * 100 : 0}%` }}
          />
        </div>
      </div>
      <p className={"text-sm tabular-nums " + (m.balance > 0 ? "font-semibold text-rose-600" : "text-muted-foreground")}>
        {L.debt}: {formatKyat(m.balance)}
      </p>
      {state !== "keep" && (
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={onKeep}
            className="rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            {L.tapToKeep}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border bg-card px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            {state === "merge" ? L.leave : `→ ${L.mergeIn}`}
          </button>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(group.suggestedKeepId);
  // Everyone except the kept record is merged in unless left out.
  const [left, setLeft] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keep = group.members.find((m) => m.id === keepId)!;
  const sources = group.members.filter((m) => m.id !== keepId && !left.includes(m.id));
  const merged = [keep, ...sources];
  const debtAfter = merged.reduce((s, m) => s + m.balance, 0);
  const salesAfter = merged.reduce((s, m) => s + m.salesCount, 0);
  const maxSales = Math.max(1, ...group.members.map((m) => m.salesCount));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
      setBusy(false);
    }
  }
  const merge = () => {
    if (sources.length === 0 || !window.confirm(L.confirm)) return;
    void run(() => api.post(`/customers/${keepId}/merge`, { sourceIds: sources.map((s) => s.id) }));
  };
  const dismiss = () =>
    void run(() => api.post("/customers/duplicates/dismiss", { ids: group.members.map((m) => m.id) }));

  return (
    <Card className={"flex flex-col gap-3 p-4 " + (busy ? "pointer-events-none opacity-60" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            "rounded-full px-2.5 py-1 text-xs font-semibold " +
            (group.exact ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")
          }
        >
          {group.exact ? `🟰 ${L.badgeExact}` : `≈ ${L.badgeSimilar(group.confidence)}`}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {group.members.length} {L.records}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {group.members.map((m) => (
          <MemberTile
            key={m.id}
            m={m}
            maxSales={maxSales}
            state={m.id === keepId ? "keep" : left.includes(m.id) ? "left" : "merge"}
            onKeep={() => {
              setKeepId(m.id);
              setLeft((p) => p.filter((x) => x !== m.id));
            }}
            onToggle={() => setLeft((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))}
          />
        ))}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">⬇ {L.result}</span>
          <span className="font-bold">{keep.name}</span>
          <span className="tabular-nums">
            🧾 {salesAfter} {L.sales}
          </span>
          <span className={"tabular-nums " + (debtAfter > 0 ? "font-semibold text-rose-600" : "")}>
            {L.debt} {formatKyat(debtAfter)}
          </span>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || sources.length === 0} onClick={merge}>
          🔀 {L.mergeBtn(sources.length)}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={dismiss}>
          ✕ {L.notSame}
        </Button>
      </div>
    </Card>
  );
}
