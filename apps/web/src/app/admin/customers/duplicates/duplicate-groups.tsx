"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type DuplicateGroup } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatDate, formatKyat } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

const L = labels.dup;

export function DuplicateGroups({ groups }: { groups: DuplicateGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        // Keyed by its members, so a group re-mounts (fresh choices) once a
        // merge or dismissal changes who is in it.
        <GroupCard key={g.members.map((m) => m.id).join("-")} group={g} />
      ))}
    </div>
  );
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(group.suggestedKeepId);
  // Everyone except the kept record is merged in unless unticked.
  const [left, setLeft] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sources = group.members.filter((m) => m.id !== keepId && !left.includes(m.id));
  const merged = group.members.filter((m) => m.id === keepId || sources.some((s) => s.id === m.id));
  const debtAfter = merged.reduce((s, m) => s + m.balance, 0);
  const salesAfter = merged.reduce((s, m) => s + m.salesCount, 0);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
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
    <Card className="flex flex-col gap-3 p-4">
      <ul className="flex flex-col gap-2">
        {group.members.map((m) => {
          const isKeep = m.id === keepId;
          const isLeft = left.includes(m.id);
          return (
            <li
              key={m.id}
              className={
                "flex flex-wrap items-center gap-3 rounded-xl border p-3 " +
                (isKeep ? "border-2 border-emerald-500 bg-emerald-50" : isLeft ? "opacity-60" : "")
              }
            >
              <div className="min-w-0 flex-1 basis-56">
                <Link href={`/admin/customers/${m.id}`} className="font-semibold hover:underline">
                  {m.name}
                </Link>
                <p className="text-xs tabular-nums text-muted-foreground">
                  #{m.id}
                  {m.contact ? ` · ${m.contact}` : ""} · {m.salesCount} {L.sales} ·{" "}
                  {m.lastSaleAt ? `${L.lastSale} ${formatDate(m.lastSaleAt)}` : L.noSales}
                </p>
              </div>
              <span
                className={
                  "shrink-0 text-sm tabular-nums " +
                  (m.balance > 0 ? "font-medium text-rose-600" : "text-muted-foreground")
                }
              >
                {L.debt}: {formatKyat(m.balance)}
              </span>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setKeepId(m.id);
                    setLeft((p) => p.filter((x) => x !== m.id));
                  }}
                  aria-pressed={isKeep}
                  className={
                    "rounded-lg px-3 py-1.5 text-sm font-semibold " +
                    (isKeep ? "bg-emerald-600 text-white" : "border bg-card hover:bg-accent")
                  }
                >
                  {isKeep ? "✓ " : ""}
                  {L.keep}
                </button>
                {!isKeep && (
                  <button
                    type="button"
                    onClick={() =>
                      setLeft((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))
                    }
                    className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    {isLeft ? L.leave : `→ ${L.mergeIn}`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {sources.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {L.after}: <span className="font-semibold text-foreground">{merged.find((m) => m.id === keepId)?.name}</span>{" "}
          · {salesAfter} {L.sales} · {L.debt} {formatKyat(debtAfter)}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || sources.length === 0} onClick={merge}>
          🔀 {L.mergeBtn(sources.length)}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={dismiss}>
          {L.notSame}
        </Button>
      </div>
    </Card>
  );
}
