"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels } from "@/lib/labels";

/**
 * One-tap switch to the other app (admin ⇄ staff). Visible only to admins —
 * staff/managers can't enter /admin. Context-aware via the current path.
 *
 * prefetch is OFF on purpose: the destination layout makes several API calls,
 * and prefetching it on every page would load the (latency-bound) backend for a
 * button that's tapped occasionally. A deliberate tap does a normal navigation.
 */
export function AppSwitchButton({
  roles,
  className,
  iconOnly,
}: {
  roles: string[];
  className?: string;
  iconOnly?: boolean;
}) {
  const pathname = usePathname();
  if (!roles.includes("admin")) return null;

  const inAdmin = pathname?.startsWith("/admin") ?? false;
  const href = inAdmin ? "/staff" : "/admin";
  const icon = inAdmin ? "🛍️" : "📊";
  const label = inAdmin ? labels.nav.staff : labels.nav.admin;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      title={label}
      className={
        className ??
        "flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
      }
    >
      <span aria-hidden className="text-base leading-none">
        {icon}
      </span>
      {!iconOnly && <span className="truncate">{label}</span>}
    </Link>
  );
}
