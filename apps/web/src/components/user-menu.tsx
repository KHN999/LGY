"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { labels } from "@/lib/labels";
import type { ShopId } from "@/lib/api-client";
import { ShopSwitcher } from "@/components/shop/shop-switcher";

interface Props {
  user: { displayName: string; username: string; roles: string[] };
  /** When set, the menu shows a Main/Test shop toggle (used by the staff home). */
  shop?: ShopId;
  /** Where to land after switching shop (e.g. "/staff"). */
  shopHome?: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: labels.auth.roleAdmin,
  staff: labels.auth.roleStaff,
  manager: labels.auth.roleManager,
};

/**
 * Replaces the standalone logout button. Tapping the user's name opens a small
 * popover; logging out requires a second tap on a confirmation button. Two
 * deliberate taps ≠ accidental brush of the header.
 */
export function UserMenu({ user, shop, shopHome }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const roleLabels = user.roles.map((r) => ROLE_LABEL[r] ?? r).join(" · ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-accent"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials || "?"}
        </span>
        <span className="hidden sm:inline">{user.displayName}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border bg-card p-3 shadow-lg"
        >
          <div className="border-b pb-3">
            <p className="text-base font-semibold">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
            {roleLabels && (
              <p className="mt-1 text-xs text-muted-foreground">{roleLabels}</p>
            )}
          </div>

          {shop && (
            <div className="border-b py-3">
              <ShopSwitcher current={shop} home={shopHome} />
            </div>
          )}

          <div className="pt-3">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {labels.auth.logout}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm">{labels.auth.logoutConfirmTitle}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  >
                    {labels.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    {loading ? labels.common.loading : labels.auth.logoutConfirmYes}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
