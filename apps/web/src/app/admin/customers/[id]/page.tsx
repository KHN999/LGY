import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { CustomerForm } from "../customer-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Customer } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await serverFetch<Customer>(`/api/customers/${id}`);
  if (!c) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/customers"
        backLabel={labels.admin.customers}
        title={c.name}
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        {labels.domain.debt}:{" "}
        <span className={c.balance > 0 ? "text-rose-600" : ""}>{formatKyat(c.balance)}</span>
      </p>
      <CustomerForm initial={c} />
    </div>
  );
}
