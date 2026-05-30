import { EmployeeForm } from "../employee-form";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";

export default function NewEmployeePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/employees"
        backLabel={labels.admin.employees}
        title={labels.common.addNew}
      />
      <EmployeeForm />
    </div>
  );
}
