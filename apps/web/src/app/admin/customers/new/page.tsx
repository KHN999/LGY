import { CustomerForm } from "../customer-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/customers"
        backLabel={labels.admin.customers}
        title={labels.common.addNew}
      />
      <CustomerForm />
    </div>
  );
}
