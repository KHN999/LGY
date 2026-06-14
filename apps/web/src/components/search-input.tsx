"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { labels } from "@/lib/labels";

/**
 * Debounced search box that drives a `?search=` URL param; the server page reads
 * it and queries the API. Reusable across sale history (staff + admin) and the
 * debt list. Uses replace() so typing doesn't spam the history stack.
 */
export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("search") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      const v = value.trim();
      if (v) params.set("search", v);
      else params.delete("search");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder ?? labels.common.search}
      className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
