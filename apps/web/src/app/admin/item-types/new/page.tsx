import Link from "next/link";
import { ItemTypeForm } from "../item-type-form";
import { labels } from "@/lib/labels";

export default function NewItemTypePage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/item-types" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.itemTypes}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <ItemTypeForm />
    </div>
  );
}
