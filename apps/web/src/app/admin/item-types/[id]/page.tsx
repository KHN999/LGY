import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { ItemTypeForm } from "../item-type-form";
import { labels } from "@/lib/labels";
import type { ItemType } from "@/lib/api-client";

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
      <Link href="/admin/item-types" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.itemTypes}
      </Link>
      <div className="flex items-center gap-3">
        {t.emoji && <span className="text-4xl">{t.emoji}</span>}
        <h1 className="text-2xl font-bold">{t.labelMy}</h1>
      </div>
      <ItemTypeForm initial={t} />
    </div>
  );
}
