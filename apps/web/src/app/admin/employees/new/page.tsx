import Link from "next/link";
import { EmployeeForm } from "../employee-form";
import { labels } from "@/lib/labels";

export default function NewEmployeePage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.employees}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <EmployeeForm />
    </div>
  );
}
