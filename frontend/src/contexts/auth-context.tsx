"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, ApiError, tokenStore } from "@/lib/api-client";
import type { LoginRequest, TokenResponse, User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** 起動時: アクセストークンがあればユーザー情報を取得する。 */
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiFetch<User>("/api/v1/auth/me")
      .then((u) => setUser(u))
      .catch(() => tokenStore.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    const data = await apiFetch<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
      skipAuth: true,
    });
    tokenStore.set(data.access_token);
    tokenStore.setRefresh(data.refresh_token);
    const me = await apiFetch<User>("/api/v1/auth/me");
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // サーバーエラーでもクライアント側はクリアする
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await apiFetch<User>("/api/v1/auth/me");
      setUser(u);
    } catch {
      // 失敗しても無視
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** AuthContext を取得する。AuthProvider の外で使うと例外を送出する。 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
