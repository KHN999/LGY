import { SupplierForm } from "../supplier-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/suppliers"
        backLabel={labels.admin.suppliers}
        title={labels.common.addNew}
      />
      <SupplierForm />
    </div>
  );
}
