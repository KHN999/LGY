import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { Page, Supplier, ItemType } from "@/lib/api-client";
import { OrderForm } from "../order-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewSupplierOrderPage() {
  const [suppliers, itemTypes] = await Promise.all([
    serverFetch<Page<Supplier>>("/api/suppliers?limit=200"),
    serverFetch<ItemType[]>("/api/item-types"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/supplier-orders"
        backLabel={labels.admin.supplierOrders}
        title={labels.common.addNew}
      />
      <OrderForm suppliers={suppliers?.data ?? []} itemTypes={itemTypes ?? []} />
    </div>
  );
}
