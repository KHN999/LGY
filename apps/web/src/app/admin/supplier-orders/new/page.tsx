import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { Page, Supplier, ItemType } from "@/lib/api-client";
import { OrderForm } from "../order-form";

export const dynamic = "force-dynamic";

export default async function NewSupplierOrderPage() {
  const [suppliers, itemTypes] = await Promise.all([
    serverFetch<Page<Supplier>>("/api/suppliers?limit=200"),
    serverFetch<ItemType[]>("/api/item-types"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/supplier-orders" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.supplierOrders}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <OrderForm suppliers={suppliers?.data ?? []} itemTypes={itemTypes ?? []} />
    </div>
  );
}
