"use client";

import { useEffect, useState } from "react";
import { labels } from "@/lib/labels";

/** Thin banner shown whenever the device is offline, so staff know the network
 *  is down (cached data still works). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="bg-amber-500 px-3 py-1 text-center text-sm font-semibold text-amber-950">
      📴 {labels.offline.noInternet}
    </div>
  );
}
