"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ManagedUser } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Button } from "@/components/ui";

const inp =
  "rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

type Role = "admin" | "staff";
const roleOf = (u: ManagedUser): Role => (u.roles.includes("admin") ? "admin" : "staff");

export function UsersManager({
  users,
  currentUserId,
}: {
  users: ManagedUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const L = labels.admin.userMgmt;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [resetId, setResetId] = useState<number | null>(null);

  // Add-user form
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [password, setPassword] = useState("");

  // Reset-password form
  const [newPassword, setNewPassword] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  const addUser = () =>
    run(async () => {
      await api.post("/users", {
        username: username.trim(),
        displayName: displayName.trim(),
        role,
        password,
      });
      setShowAdd(false);
      setUsername("");
      setDisplayName("");
      setRole("staff");
      setPassword("");
    });

  const resetPassword = (id: number) =>
    run(async () => {
      await api.post(`/users/${id}/password`, { password: newPassword });
      setResetId(null);
      setNewPassword("");
    });

  const changeStatus = (id: number, status: "ACTIVE" | "DISABLED") => {
    if (status === "DISABLED" && !confirm(L.confirmDisable)) return;
    run(() => api.patch(`/users/${id}`, { status }));
  };

  const changeRole = (id: number, r: Role) => run(() => api.patch(`/users/${id}`, { role: r }));

  const addValid =
    username.trim().length >= 2 && displayName.trim().length >= 1 && password.length >= 4;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Button type="button" variant="primary" onClick={() => setShowAdd((v) => !v)}>
          ＋ {L.add}
        </Button>
      </div>

      {showAdd && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4">
          <h3 className="text-base font-semibold">{L.add}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L.username}>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inp}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </Field>
            <Field label={L.displayName}>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inp} />
            </Field>
            <Field label={L.role}>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inp}>
                <option value="staff">{L.roleStaff}</option>
                <option value="admin">{L.roleAdmin}</option>
              </select>
            </Field>
            <Field label={L.password}>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={L.passwordHint}
                className={inp}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
              {labels.common.cancel}
            </Button>
            <Button type="button" variant="primary" onClick={addUser} disabled={busy || !addValid}>
              {busy ? labels.common.saving : labels.common.save}
            </Button>
          </div>
        </section>
      )}

      <ul className="flex flex-col gap-3">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const disabled = u.status === "DISABLED";
          return (
            <li
              key={u.id}
              className={`rounded-2xl border bg-card p-4 ${disabled ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.displayName}
                    {isSelf && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {L.you}
                      </span>
                    )}
                    {disabled && (
                      <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                        {L.disabled}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={roleOf(u)}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                    disabled={busy || isSelf}
                    className="rounded-lg border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                    aria-label={L.role}
                  >
                    <option value="staff">{L.roleStaff}</option>
                    <option value="admin">{L.roleAdmin}</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setResetId(resetId === u.id ? null : u.id);
                      setNewPassword("");
                    }}
                    disabled={busy}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {L.resetPassword}
                  </button>

                  {!isSelf &&
                    (disabled ? (
                      <button
                        type="button"
                        onClick={() => changeStatus(u.id, "ACTIVE")}
                        disabled={busy}
                        className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm text-emerald-700 disabled:opacity-50"
                      >
                        {L.enable}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => changeStatus(u.id, "DISABLED")}
                        disabled={busy}
                        className="rounded-lg border px-3 py-1.5 text-sm text-destructive disabled:opacity-50"
                      >
                        {L.disable}
                      </button>
                    ))}
                </div>
              </div>

              {resetId === u.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-sm font-medium">{L.newPassword}</span>
                    <input
                      autoFocus
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={L.passwordHint}
                      className={inp}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => resetPassword(u.id)}
                    disabled={busy || newPassword.length < 4}
                  >
                    {busy ? labels.common.saving : labels.common.save}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
