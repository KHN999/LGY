import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewTailorPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/tailors"
        backLabel={labels.admin.tailors}
        title={labels.common.addNew}
      />
      <TailorForm />
    </div>
  );
}
