import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { EmployeeForm } from "../employee-form";
import { labels } from "@/lib/labels";
import type { Employee } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await serverFetch<Employee>(`/api/employees/${id}`);
  if (!e) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/employees" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.employees}
      </Link>
      <h1 className="text-2xl font-bold">{e.name}</h1>
      <EmployeeForm initial={e} />
    </div>
  );
}
