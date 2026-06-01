"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";

/** ログインページ。左：ブランドパネル、右：フォームパネル。 */
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else {
        setError("ログインに失敗しました。しばらくしてから再試行してください");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      background: "radial-gradient(ellipse at 20% 30%, color-mix(in oklab, var(--c-primary) 18%, var(--c-bg)) 0%, var(--c-bg) 55%), var(--c-bg)",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "920px",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        background: "var(--c-surface)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(17,24,39,0.16), 0 4px 8px rgba(17,24,39,0.06)",
        border: "1px solid var(--c-border)",
        minHeight: "540px",
      }}>

        {/* ===== 左：ブランドパネル ===== */}
        <div style={{
          background: "var(--c-primary)",
          color: "#fff",
          padding: "36px 40px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* 装飾円 */}
          <div style={{ position: "absolute", top: -120, right: -100, width: 360, height: 360, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", bottom: -200, left: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

          {/* ロゴ */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
            <div style={{
              width: 44, height: 44,
              background: "#fff",
              color: "var(--c-primary)",
              borderRadius: "var(--r-md)",
              display: "grid", placeItems: "center",
              fontWeight: 800, fontSize: 16, letterSpacing: 1,
            }}>CL</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.04em" }}>
                Construction Manager v3
              </div>
              <div style={{ fontWeight: 400, color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: "0.1em", marginTop: 2 }}>
                株式会社クラップ
              </div>
            </div>
          </div>

          {/* キャッチコピー */}
          <div style={{ marginTop: "auto", zIndex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.4, letterSpacing: "-0.01em" }}>
              工事台帳を、<br />みんなで使えるかたちに。
            </h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", lineHeight: 1.7, fontSize: 13 }}>
              30年続いたExcelの仕事をWebへ。<br />
              同時編集・自動集計・スキャン解析を、<br />
              慣れた業務感覚のままで。
            </p>

            {/* 統計バッジ */}
            <div style={{ marginTop: 24, display: "flex", gap: 14, zIndex: 1 }}>
              {[
                { v: "128", k: "登録案件（2026年度）" },
                { v: "86",  k: "業者マスタ" },
                { v: "94%", k: "スキャン精度" },
              ].map((f) => (
                <div key={f.k} style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 12px",
                }}>
                  <div style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, fontSize: 18 }}>{f.v}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 1, letterSpacing: "0.02em" }}>{f.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 右：フォームパネル ===== */}
        <div style={{
          padding: "48px 40px",
          display: "flex",
          flexDirection: "column",
        }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--c-text)" }}>
            サインイン
          </h1>
          <p style={{ margin: "0 0 26px", fontSize: 13, color: "var(--c-text-muted)" }}>
            あなたのアカウントでログインしてください。
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* メールアドレス */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 5, letterSpacing: "0.02em" }}>
                メールアドレス
              </label>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-muted)", width: 16, height: 16, strokeWidth: 1.6 }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <path d="M22 6l-10 7L2 6" />
                </svg>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@clap-corp.example"
                  style={{
                    width: "100%",
                    background: "var(--c-surface)",
                    border: "1.5px solid var(--c-border)",
                    borderRadius: "var(--r-md)",
                    padding: "9px 14px 9px 38px",
                    fontSize: 14,
                    color: "var(--c-text)",
                    fontFamily: "var(--ff-sans)",
                    lineHeight: 1.5,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                  onFocus={(e) => { e.target.style.outline = "2px solid var(--c-primary)"; e.target.style.outlineOffset = "-1px"; e.target.style.borderColor = "var(--c-primary)"; }}
                  onBlur={(e) => { e.target.style.outline = "none"; e.target.style.borderColor = "var(--c-border)"; }}
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 5, letterSpacing: "0.02em" }}>
                パスワード
              </label>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-muted)", width: 16, height: 16, strokeWidth: 1.6 }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    background: "var(--c-surface)",
                    border: "1.5px solid var(--c-border)",
                    borderRadius: "var(--r-md)",
                    padding: "9px 14px 9px 38px",
                    fontSize: 14,
                    color: "var(--c-text)",
                    fontFamily: "var(--ff-sans)",
                    lineHeight: 1.5,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                  onFocus={(e) => { e.target.style.outline = "2px solid var(--c-primary)"; e.target.style.outlineOffset = "-1px"; e.target.style.borderColor = "var(--c-primary)"; }}
                  onBlur={(e) => { e.target.style.outline = "none"; e.target.style.borderColor = "var(--c-border)"; }}
                />
              </div>
            </div>

            {/* エラー */}
            {error && (
              <div style={{
                background: "var(--c-danger-bg)",
                border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
                borderRadius: "var(--r-md)",
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--c-danger)",
              }}>
                {error}
              </div>
            )}

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "11px 14px",
                background: isSubmitting ? "var(--c-primary-hover)" : "var(--c-primary)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--r-md)",
                fontSize: 14,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "var(--ff-sans)",
                opacity: isSubmitting ? 0.8 : 1,
                transition: "background 0.15s",
              }}
            >
              {isSubmitting ? "サインイン中..." : "サインイン"}
              {!isSubmitting && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>

          <div style={{ marginTop: "auto", paddingTop: 24, fontSize: 11, color: "var(--c-text-subtle)", textAlign: "center" }}>
            © 2026 株式会社クラップ
          </div>
        </div>
      </div>
    </div>
  );
}
