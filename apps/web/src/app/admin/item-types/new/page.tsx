import { ItemTypeForm } from "../item-type-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewItemTypePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/item-types"
        backLabel={labels.admin.itemTypes}
        title={labels.common.addNew}
      />
      <ItemTypeForm />
    </div>
  );
}
