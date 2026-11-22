import type { ShopId, ShopInfo } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "./shop-switch-button";
import { shopName } from "./shop-name";

/**
 * Always-visible banner whenever the browser is NOT in the main shop, so nobody
 * can mistake which shop they are working in. The practice shop gets the loud
 * amber "test" banner; any other shop gets a calmer one with its name. Everyone
 * gets a one-tap way back to main; `home` is where to land after switching.
 * Renders nothing in main.
 */
export function ShopBanner({ shop, shops, home }: { shop: ShopId; shops?: ShopInfo[]; home: string }) {
  if (shop === "main") return null;
  const sandbox = shops ? (shops.find((s) => s.key === shop)?.sandbox ?? false) : shop === "playground";
  if (sandbox) {
    return (
      <div className="flex items-center justify-center gap-3 border-b-2 border-amber-500 bg-amber-400 px-4 py-2 text-center text-amber-950">
        <span className="text-sm font-bold sm:text-base">
          🧪 {labels.shop.bannerTitle}
          <span className="ml-2 hidden font-normal sm:inline">{labels.shop.bannerNote}</span>
        </span>
        <ShopSwitchButton
          to="main"
          home={home}
          className="shrink-0 rounded-lg bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
        >
          {labels.shop.backToMain}
        </ShopSwitchButton>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-3 border-b-2 border-sky-600 bg-sky-100 px-4 py-2 text-center text-sky-950">
      <span className="text-sm font-bold sm:text-base">🏬 {shopName(shop, shops)}</span>
      <ShopSwitchButton
        to="main"
        home={home}
        className="shrink-0 rounded-lg bg-sky-900 px-3 py-1 text-xs font-semibold text-sky-50 hover:bg-sky-800"
      >
        {labels.shop.backToMain}
      </ShopSwitchButton>
    </div>
  );
}
