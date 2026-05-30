import { serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "./shop-switch-button";

/**
 * Admin-header control showing the current shop and a one-tap toggle. Admin
 * only — this is how an admin enters the test sandbox (the loud banner handles
 * the way back). Defaults to the main shop if the state can't be read.
 */
export async function ShopSwitcher() {
  const data = await serverFetch<ShopState>("/api/shop");
  const shop = data?.shop ?? "main";

  if (shop === "playground") {
    return (
      <ShopSwitchButton
        to="main"
        className="rounded-full border-2 border-amber-500 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
      >
        🧪 <span className="hidden sm:inline">{labels.shop.test} · </span>
        {labels.shop.backToMain}
      </ShopSwitchButton>
    );
  }

  return (
    <ShopSwitchButton
      to="playground"
      className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
    >
      🧪 <span className="hidden sm:inline">{labels.shop.switchToTest}</span>
    </ShopSwitchButton>
  );
}
