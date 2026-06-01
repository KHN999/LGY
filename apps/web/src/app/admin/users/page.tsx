import { getCurrentUser, serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ManagedUser } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, me] = await Promise.all([
    serverFetch<ManagedUser[]>("/api/users"),
    getCurrentUser(),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.users} />
      <UsersManager users={users ?? []} currentUserId={me?.id ?? 0} />
    </div>
  );
}
