import { cookies } from "next/headers";

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  roles: string[];
  photoUrl: string | null;
}

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Server-component helper. Returns the authenticated user, or null if the
 * session cookie is missing/invalid/expired.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  if (!cookieHeader) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: CurrentUser };
    return data.user;
  } catch {
    return null;
  }
}

export function hasRole(user: CurrentUser | null, role: string): boolean {
  return !!user?.roles.includes(role);
}

/**
 * Server-side authenticated fetch. Use this from server components / page loaders
 * to call the backend with the current user's cookie forwarded. Returns null on
 * non-2xx so pages can render a friendly empty state.
 */
export async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
