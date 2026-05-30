import { DriverForm } from "../driver-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewDriverPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/drivers"
        backLabel={labels.admin.drivers}
        title={labels.common.addNew}
      />
      <DriverForm />
    </div>
  );
}
