import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { EmployeeForm } from "../employee-form";
import { labels } from "@/lib/labels";
import type { Employee } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await serverFetch<Employee>(`/api/employees/${id}`);
  if (!e) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/employees"
        backLabel={labels.admin.employees}
        title={e.name}
      />
      <EmployeeForm initial={e} />
    </div>
  );
}
