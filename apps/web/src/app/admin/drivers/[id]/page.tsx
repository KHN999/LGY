import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { DriverForm } from "../driver-form";
import { labels } from "@/lib/labels";
import type { Driver } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await serverFetch<Driver>(`/api/drivers/${id}`);
  if (!d) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/drivers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.drivers}
      </Link>
      <h1 className="text-2xl font-bold">{d.name}</h1>
      <DriverForm initial={d} />
    </div>
  );
}
