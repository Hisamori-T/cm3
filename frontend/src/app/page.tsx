"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** ルートページ。認証状態に応じて /dashboard または /login にリダイレクト。 */
export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--c-bg)" }}>
      <p className="text-sm" style={{ color: "var(--c-text-muted)" }}>読み込み中...</p>
    </div>
  );
}
