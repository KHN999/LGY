import Link from "next/link";
import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";

export default function NewTailorPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/tailors" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.tailors}
      </Link>
      <h1 className="text-2xl font-bold">{labels.common.addNew}</h1>
      <TailorForm />
    </div>
  );
}
