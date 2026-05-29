import Link from "next/link";
import { SupplierForm } from "../supplier-form";
import { labels } from "@/lib/labels";

export default function NewSupplierPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/suppliers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.suppliers}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <SupplierForm />
    </div>
  );
}
