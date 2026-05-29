"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels } from "@/lib/labels";

const items = [
  { href: "/admin", label: labels.admin.dashboard, exact: true },
  { href: "/admin/item-types", label: labels.admin.itemTypes },
  { href: "/admin/customers", label: labels.admin.customers },
  { href: "/admin/suppliers", label: labels.admin.suppliers },
  { href: "/admin/tailors", label: labels.admin.tailors },
  { href: "/admin/drivers", label: labels.admin.drivers },
  { href: "/admin/employees", label: labels.admin.employees },
  { href: "/admin/opening-stock", label: labels.admin.openingStock },
  { href: "/admin/supplier-orders", label: labels.admin.supplierOrders },
  { href: "/admin/transfers", label: labels.admin.transfers },
  { href: "/admin/closes", label: labels.admin.closes },
  { href: "/admin/sales", label: labels.admin.sales },
  { href: "/admin/stock-count", label: labels.admin.stockCount },
  { href: "/admin/exceptions", label: labels.admin.exceptions },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "rounded-lg px-3 py-2 text-sm transition " +
              (active
                ? "bg-primary text-primary-foreground"
                : "border bg-card hover:bg-accent")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
