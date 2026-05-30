import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { DriverForm } from "../driver-form";
import { labels } from "@/lib/labels";
import type { Driver } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await serverFetch<Driver>(`/api/drivers/${id}`);
  if (!d) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/drivers"
        backLabel={labels.admin.drivers}
        title={d.name}
      />
      <DriverForm initial={d} />
    </div>
  );
}
