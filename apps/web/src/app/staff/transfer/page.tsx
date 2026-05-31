import { serverFetch } from "@/lib/auth-server";
import type { Page, Driver } from "@/lib/api-client";
import { TransferFlow } from "./transfer-flow";

export const dynamic = "force-dynamic";

export default async function TransferPage() {
  const drivers = await serverFetch<Page<Driver>>("/api/drivers?limit=200");
  return <TransferFlow drivers={drivers?.data ?? []} />;
}
