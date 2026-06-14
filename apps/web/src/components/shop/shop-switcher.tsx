import type { ShopId } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "./shop-switch-button";

/**
 * Shop toggle (admin sidebar + staff account menu). Presentational: the active
 * shop is passed in (fetched once by the layout). `home` is where to land after
 * switching — /admin for the sidebar, /staff for the staff menu.
 */
export function ShopSwitcher({ current, home }: { current: ShopId; home?: string }) {
  if (current === "playground") {
    return (
      <ShopSwitchButton
        to="main"
        home={home}
        className="w-full rounded-lg border-2 border-amber-500 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-200"
      >
        🧪 {labels.shop.test} · {labels.shop.backToMain}
      </ShopSwitchButton>
    );
  }
  return (
    <ShopSwitchButton
      to="playground"
      home={home}
      className="w-full rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
    >
      🧪 {labels.shop.switchToTest}
    </ShopSwitchButton>
  );
}
