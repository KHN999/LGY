import { labels } from "@/lib/labels";
import { StockCountForm } from "./stock-count-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function StockCountPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.stockCount.title} subtitle={labels.stockCount.help} />
      <StockCountForm />
    </div>
  );
}
