import Link from "next/link";
import { DriverForm } from "../driver-form";
import { labels } from "@/lib/labels";

export default function NewDriverPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/drivers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.drivers}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <DriverForm />
    </div>
  );
}
