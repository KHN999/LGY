import type { ShopId } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "./shop-switch-button";

/**
 * Loud, always-visible banner shown to EVERY user whenever the browser is in
 * the test/playground shop — so staff can never mistake practice for real work.
 * Admins also get a one-tap way back to the real shop. Renders nothing in main.
 */
export function ShopBanner({ shop, isAdmin }: { shop: ShopId; isAdmin: boolean }) {
  if (shop !== "playground") return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b-2 border-amber-500 bg-amber-400 px-4 py-2 text-center text-amber-950">
      <span className="text-sm font-bold sm:text-base">
        🧪 {labels.shop.bannerTitle}
        <span className="ml-2 hidden font-normal sm:inline">{labels.shop.bannerNote}</span>
      </span>
      {isAdmin && (
        <ShopSwitchButton
          to="main"
          className="shrink-0 rounded-lg bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
        >
          {labels.shop.backToMain}
        </ShopSwitchButton>
      )}
    </div>
  );
}
