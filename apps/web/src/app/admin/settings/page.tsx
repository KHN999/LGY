import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ShopSettings } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

const FALLBACK: ShopSettings = {
  shopName: "LGY",
  addressLine: null,
  phone: null,
  social: null,
  receiptHeader: null,
  receiptFooter: null,
};

export default async function AdminSettingsPage() {
  const settings = await serverFetch<ShopSettings>("/api/settings");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.settings.title} subtitle={labels.settings.help} />
      <SettingsForm initial={settings ?? FALLBACK} />
    </div>
  );
}
