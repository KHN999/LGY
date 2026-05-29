import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { CustomerForm } from "../customer-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Customer } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await serverFetch<Customer>(`/api/customers/${id}`);
  if (!c) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/customers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.customers}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.domain.debt}:{" "}
          <span className={c.balance > 0 ? "text-rose-600" : ""}>{formatKyat(c.balance)}</span>
        </p>
      </div>
      <CustomerForm initial={c} />
    </div>
  );
}
