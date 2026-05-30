import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { ItemTypeForm } from "../item-type-form";
import { labels } from "@/lib/labels";
import type { ItemType } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditItemTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await serverFetch<ItemType>(`/api/item-types/${id}`);
  if (!t) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/item-types"
        backLabel={labels.admin.itemTypes}
        title={t.emoji ? `${t.emoji} ${t.labelMy}` : t.labelMy}
      />
      <ItemTypeForm initial={t} />
    </div>
  );
}
