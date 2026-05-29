import { labels } from "@/lib/labels";
import { StockCountForm } from "./stock-count-form";

export const dynamic = "force-dynamic";

export default function StockCountPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{labels.stockCount.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.stockCount.help}</p>
      </div>
      <StockCountForm />
    </div>
  );
}
