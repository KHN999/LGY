"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { labels } from "@/lib/labels";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const DASHBOARD: NavItem = { href: "/admin", label: labels.admin.dashboard, exact: true };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: labels.admin.navGroups.people,
    items: [
      { href: "/admin/customers", label: labels.admin.customers },
      { href: "/admin/suppliers", label: labels.admin.suppliers },
      { href: "/admin/tailors", label: labels.admin.tailors },
      { href: "/admin/drivers", label: labels.admin.drivers },
      { href: "/admin/employees", label: labels.admin.employees },
    ],
  },
  {
    title: labels.admin.navGroups.stock,
    items: [
      { href: "/admin/item-types", label: labels.admin.itemTypes },
      { href: "/admin/opening-stock", label: labels.admin.openingStock },
      { href: "/admin/transfers", label: labels.admin.transfers },
      { href: "/admin/stock-count", label: labels.admin.stockCount },
    ],
  },
  {
    title: labels.admin.navGroups.money,
    items: [
      { href: "/admin/sales", label: labels.admin.sales },
      { href: "/admin/supplier-orders", label: labels.admin.supplierOrders },
      { href: "/admin/closes", label: labels.admin.closes },
    ],
  },
  {
    title: labels.admin.navGroups.system,
    items: [
      { href: "/admin/exceptions", label: labels.admin.exceptions },
      { href: "/admin/settings", label: labels.admin.settings },
    ],
  },
];

const FLAT: NavItem[] = [DASHBOARD, ...GROUPS.flatMap((g) => g.items)];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Horizontal nav bar — desktop only. */
export function AdminDesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden flex-wrap gap-2 md:flex">
      {FLAT.map((it) => {
        const active = isActive(pathname, it);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "rounded-lg px-3 py-2 text-sm transition " +
              (active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Hamburger + slide-in grouped drawer — mobile only. */
export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = FLAT.find((it) => isActive(pathname, it));

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium"
      >
        <span aria-hidden className="text-base leading-none">
          ☰
        </span>
        <span className="max-w-[40vw] truncate">{current?.label ?? labels.admin.dashboard}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-card p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-semibold">{labels.common.appName} {labels.nav.admin}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg border px-2.5 py-1 text-sm"
              >
                ✕
              </button>
            </div>

            <Link
              href={DASHBOARD.href}
              className={
                "block rounded-lg px-3 py-2.5 text-sm font-medium " +
                (isActive(pathname, DASHBOARD)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent")
              }
            >
              {DASHBOARD.label}
            </Link>

            {GROUPS.map((g) => (
              <div key={g.title} className="mt-4">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </p>
                {g.items.map((it) => {
                  const active = isActive(pathname, it);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={
                        "block rounded-lg px-3 py-2.5 text-sm " +
                        (active ? "bg-primary text-primary-foreground" : "hover:bg-accent")
                      }
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
