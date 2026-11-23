import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { DuplicateGroup } from "@/lib/api-client";
import { PageHeader, EmptyState, Card } from "@/components/ui";
import { DuplicateGroups } from "./duplicate-groups";

export const dynamic = "force-dynamic";

const L = labels.dup;

export default async function CustomerDuplicatesPage() {
  const data = await serverFetch<{ groups: DuplicateGroup[] }>("/api/customers/duplicates");
  const groups = data?.groups ?? [];
  const records = groups.reduce((s, g) => s + g.members.length, 0);
  const exact = groups.filter((g) => g.exact).length;
  // Debt sitting on records that would be folded into another one.
  const splitDebt = groups.reduce(
    (s, g) =>
      s + g.members.filter((m) => m.id !== g.suggestedKeepId).reduce((x, m) => x + Math.max(0, m.balance), 0),
    0,
  );
  const stats = [
    { label: L.statGroups, value: groups.length.toLocaleString("en-US"), icon: "🔀" },
    { label: L.statExtra, value: (records - groups.length).toLocaleString("en-US"), icon: "🗂️" },
    { label: L.statExact, value: exact.toLocaleString("en-US"), icon: "🟰" },
    { label: L.statDebt, value: formatKyat(splitDebt), icon: "💳" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        backHref="/admin/customers"
        backLabel={labels.admin.customers}
      />
      {groups.length === 0 ? (
        <EmptyState>✅ {L.none}</EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="p-3">
                <p className="text-xs text-muted-foreground">
                  {s.icon} {s.label}
                </p>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
              </Card>
            ))}
          </section>
          <p className="text-sm text-muted-foreground">ℹ️ {L.nothingSaved}</p>
          <DuplicateGroups groups={groups} />
        </>
      )}
    </div>
  );
}
