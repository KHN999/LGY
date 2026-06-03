"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { labels } from "@/lib/labels";
import type { ShopId } from "@/lib/api-client";
import { UserMenu } from "@/components/user-menu";
import { ShopSwitcher } from "@/components/shop/shop-switcher";
import { AppSwitchButton } from "@/components/app-switch-button";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const DASHBOARD: NavItem = { href: "/admin", label: labels.admin.dashboard, icon: "📊", exact: true };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: labels.admin.navGroups.people,
    items: [
      { href: "/admin/customers", label: labels.admin.customers, icon: "👤" },
      { href: "/admin/suppliers", label: labels.admin.suppliers, icon: "🏭" },
      { href: "/admin/tailors", label: labels.admin.tailors, icon: "🧵" },
      { href: "/admin/drivers", label: labels.admin.drivers, icon: "🚚" },
      { href: "/admin/employees", label: labels.admin.employees, icon: "🧑‍💼" },
    ],
  },
  {
    title: labels.admin.navGroups.stock,
    items: [
      { href: "/admin/item-types", label: labels.admin.itemTypes, icon: "🏷️" },
      { href: "/admin/opening-stock", label: labels.admin.openingStock, icon: "📦" },
      { href: "/admin/transfers", label: labels.admin.transfers, icon: "🔁" },
      { href: "/admin/stock-count", label: labels.admin.stockCount, icon: "🔢" },
    ],
  },
  {
    title: labels.admin.navGroups.money,
    items: [
      { href: "/admin/sales", label: labels.admin.sales, icon: "🧾" },
      { href: "/admin/supplier-orders", label: labels.admin.supplierOrders, icon: "📥" },
      { href: "/admin/expenses", label: labels.admin.expenses, icon: "💸" },
      { href: "/admin/closes", label: labels.admin.closes, icon: "💰" },
    ],
  },
  {
    title: labels.admin.navGroups.system,
    items: [
      { href: "/admin/exceptions", label: labels.admin.exceptions, icon: "⚠️" },
      { href: "/admin/users", label: labels.admin.users, icon: "🔐" },
      { href: "/admin/audit", label: labels.admin.audit, icon: "📋" },
      { href: "/admin/export", label: labels.admin.export, icon: "⬇️" },
      { href: "/admin/settings", label: labels.admin.settings, icon: "⚙️" },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition " +
        (active ? "bg-primary text-primary-foreground" : "hover:bg-accent")
      }
    >
      <span aria-hidden className="text-base leading-none">
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarContent({
  user,
  currentShop,
  onNavigate,
}: {
  user: { displayName: string; username: string; roles: string[] };
  currentShop: ShopId;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-lg font-bold">{labels.common.appName} {labels.nav.admin}</span>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close"
            className="rounded-lg border px-2.5 py-1 text-sm lg:hidden"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <NavLink item={DASHBOARD} pathname={pathname} onNavigate={onNavigate} />
        {GROUPS.map((g) => (
          <div key={g.title} className="pt-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.title}
            </p>
            {g.items.map((it) => (
              <NavLink key={it.href} item={it} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t p-3">
        <AppSwitchButton
          roles={user.roles}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
        />
        <ShopSwitcher current={currentShop} />
        <div className="hidden lg:block">
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  user,
  currentShop,
  children,
}: {
  user: { displayName: string; username: string; roles: string[] };
  currentShop: ShopId;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-card lg:block">
        <SidebarContent user={user} currentShop={currentShop} />
      </aside>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar — sticky so the menu (and ☰) is always reachable
            without scrolling back to the top of a long page. */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-card px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="shrink-0 rounded-lg border bg-card px-3 py-2 text-base leading-none"
          >
            ☰
          </button>
          <span className="min-w-0 truncate font-semibold">
            {labels.common.appName} {labels.nav.admin}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <AppSwitchButton roles={user.roles} />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto bg-card shadow-xl">
            <SidebarContent user={user} currentShop={currentShop} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
