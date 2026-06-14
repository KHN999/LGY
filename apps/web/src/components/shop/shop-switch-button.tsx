"use client";

import { useState } from "react";
import type { ShopId } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/**
 * Switches this browser's active shop, then does a full navigation to a safe
 * home (`home`) so every server component re-renders against the new shop's
 * data. `home` defaults to /admin; the staff app passes /staff.
 */
export function ShopSwitchButton({
  to,
  home = "/admin",
  className,
  children,
}: {
  to: ShopId;
  home?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: to }),
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      window.location.assign(home);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={go} disabled={loading} className={className}>
      {loading ? labels.common.loading : children}
    </button>
  );
}
