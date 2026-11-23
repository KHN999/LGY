"use client";

import { useLinkStatus } from "next/link";

/**
 * A small spinner shown inside a <Link> from the moment it is tapped until the
 * next page starts to appear. On a slow connection a tap otherwise looks like
 * it did nothing, and people tap again.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="ml-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
    />
  );
}
