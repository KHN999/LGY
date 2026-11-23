import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { DuplicateGroup } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DuplicateGroups } from "./duplicate-groups";

export const dynamic = "force-dynamic";

export default async function CustomerDuplicatesPage() {
  const data = await serverFetch<{ groups: DuplicateGroup[] }>("/api/customers/duplicates");
  const groups = data?.groups ?? [];
  const records = groups.reduce((s, g) => s + g.members.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.dup.title}
        subtitle={labels.dup.subtitle}
        backHref="/admin/customers"
        backLabel={labels.admin.customers}
      />
      {groups.length === 0 ? (
        <EmptyState>{labels.dup.none}</EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{labels.dup.groups(groups.length, records)}</p>
          <DuplicateGroups groups={groups} />
        </>
      )}
    </div>
  );
}
