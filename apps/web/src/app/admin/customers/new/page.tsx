import Link from "next/link";
import { CustomerForm } from "../customer-form";
import { labels } from "@/lib/labels";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/customers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.customers}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <CustomerForm />
    </div>
  );
}
