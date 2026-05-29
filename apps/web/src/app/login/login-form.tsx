"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { labels } from "@/lib/labels";

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (!res.ok) {
        setError(labels.auth.loginFailed);
        return;
      }
      const data = (await res.json()) as {
        user: { roles: string[] };
      };
      const dest =
        redirectTo ??
        (data.user.roles.includes("admin")
          ? "/admin"
          : data.user.roles.includes("staff")
            ? "/staff"
            : "/");
      router.push(dest);
      router.refresh();
    } catch {
      setError(labels.errors.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">{labels.auth.username}</span>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border bg-background px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">{labels.auth.password}</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border bg-background px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? labels.common.loading : labels.auth.login}
      </button>
    </form>
  );
}
