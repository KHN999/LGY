import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";

export interface User {
  id: number;
  username: string;
  displayName: string;
  roles: string[];
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const r = await api.get<{ user: User }>("/auth/me");
          setUser(r.user);
        } catch {
          await setToken(null); // stale/expired
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string) {
    const r = await api.post<{ user: User; token: string }>("/auth/login", { username, password });
    await setToken(r.token);
    setUser(r.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      /* offline / already gone */
    }
    await setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
