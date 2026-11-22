import type { ShopId, ShopInfo } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "./shop-switch-button";
import { FALLBACK_SHOPS, shopName } from "./shop-name";

/**
 * Shop chooser (admin sidebar + staff account menu). Presentational: the active
 * shop and the list are passed in (fetched once by the layout). Shows which
 * shop you are in and one button per other shop. `home` is where to land after
 * switching — /admin for the sidebar, /staff for the staff menu.
 */
export function ShopSwitcher({ current, shops, home }: { current: ShopId; shops?: ShopInfo[]; home?: string }) {
  const list = shops && shops.length > 0 ? shops : FALLBACK_SHOPS;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-xs text-muted-foreground">
        {labels.shop.current}: <span className="font-semibold text-foreground">{shopName(current, list)}</span>
      </p>
      {list
        .filter((s) => s.key !== current)
        .map((s) => (
          <ShopSwitchButton
            key={s.key}
            to={s.key}
            home={home}
            className={
              "w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-accent " +
              (s.sandbox ? "border-amber-300 bg-amber-50 text-amber-900" : "bg-card text-muted-foreground")
            }
          >
            {s.sandbox ? "🧪" : "🏬"} {shopName(s.key, list)} {labels.shop.switchTo}
          </ShopSwitchButton>
        ))}
    </div>
  );
}
