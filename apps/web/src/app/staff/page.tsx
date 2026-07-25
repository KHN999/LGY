import Link from "next/link";
import { getCurrentUser, serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { UserMenu } from "@/components/user-menu";
import { AppSwitchButton } from "@/components/app-switch-button";
import { StaffDatePicker } from "@/components/staff/staff-date";
import { labels } from "@/lib/labels";

const actions = [
  { href: "/staff/sell", label: labels.staff.sell, icon: "🛍️", color: "bg-emerald-600" },
  { href: "/staff/sales", label: labels.history.title, icon: "🧾", color: "bg-cyan-700" },
  { href: "/staff/receive", label: labels.staff.receive, icon: "💵", color: "bg-amber-600" },
  { href: "/staff/debts", label: labels.staff.debts, icon: "📋", color: "bg-violet-600" },
  { href: "/staff/transfer", label: labels.staff.transfer, icon: "🚚", color: "bg-sky-600" },
  { href: "/staff/cut", label: labels.staff.cut, icon: "✂️", color: "bg-teal-600" },
  { href: "/staff/wash", label: labels.staff.wash, icon: "🧼", color: "bg-cyan-600" },
  { href: "/staff/stock", label: labels.staff.viewStock, icon: "📦", color: "bg-slate-600" },
  { href: "/staff/stock-movements", label: labels.movements.title, icon: "📜", color: "bg-slate-700" },
  { href: "/staff/close", label: labels.staff.close, icon: "🌙", color: "bg-rose-600" },
];

const savedMessages: Record<string, string> = {
  sell: labels.sell.success,
  receive: labels.receive.success,
  transfer: labels.transfer.success,
  close: labels.close.success,
};

export default async function StaffHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const savedKey = params.saved;
  const flash = savedKey ? savedMessages[savedKey] : undefined;
  const [user, shopState] = await Promise.all([
    getCurrentUser(),
    serverFetch<ShopState>("/api/shop"),
  ]);
  const shop = shopState?.shop ?? "main";
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.staff.home}</h1>
        <div className="flex items-center gap-2">
          {user && <AppSwitchButton roles={user.roles} />}
          {user && <UserMenu user={user} shop={shop} shopHome="/staff" />}
        </div>
      </div>
      {flash && (
        <p className="mb-4 rounded-lg bg-emerald-100 p-3 text-center text-emerald-900">
          {flash}
        </p>
      )}
      <div className="mb-4">
        <StaffDatePicker />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${a.color} flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center font-semibold text-white shadow-md active:scale-95 transition`}
          >
            <span className="text-5xl">{a.icon}</span>
            <span className="text-xl leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
