"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { labels } from "@/lib/labels";

export function BackToSalesButton() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    router.prefetch("/staff/sales");
  }, [router]);

  return (
    <button
      type="button"
      disabled={navigating}
      onClick={() => {
        setNavigating(true);
        router.push("/staff/sales");
      }}
      className="inline-flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 text-sm disabled:opacity-70"
    >
      <span aria-hidden>{navigating ? "..." : "<-"}</span>
      <span>{navigating ? labels.common.loading : labels.history.title}</span>
    </button>
  );
}
