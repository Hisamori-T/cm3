"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/types/auth";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "システム管理者",
  admin: "管理者",
  member: "メンバー",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** マイプロフィール編集画面。 */
export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setDepartment(user.department ?? "");
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    if (newPw && newPw !== confirmPw) {
      setMsg({ text: "新しいパスワードが一致しません", error: true });
      return;
    }
    if (newPw && newPw.length < 8) {
      setMsg({ text: "パスワードは8文字以上で入力してください", error: true });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, string | null> = {
        full_name: fullName || null,
        department: department || null,
      };
      if (newPw) {
        body.current_password = currentPw;
        body.new_password = newPw;
      }
      const updated = await apiFetch<User>("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await refreshUser();
      setMsg({ text: "保存しました", error: false });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setFullName(updated.full_name);
      setDepartment(updated.department ?? "");
    } catch (e) {
      setMsg({ text: (e as Error).message ?? "保存に失敗しました", error: true });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <AppShell
      breadcrumbs={[{ label: "マイプロフィール" }]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {msg && (
            <span style={{ fontSize: 13, color: msg.error ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg.text}
            </span>
          )}
          <Button variant="default" size="sm" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      }
    >
      <div className="toolbar">
        <h1>マイプロフィール</h1>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
          {/* 基本情報 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 12 }}>基本情報</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="氏名">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="氏名を入力"
                />
              </Field>
              <Field label="部署">
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="部署名を入力（任意）"
                />
              </Field>
              <Field label="メールアドレス">
                <Input value={user?.email ?? ""} disabled />
              </Field>
              <Field label="社員番号">
                <Input value={user?.employee_number?.toString() ?? "未設定"} disabled />
              </Field>
              <Field label="権限">
                <div style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "4px 12px", borderRadius: "var(--r-pill)",
                  fontSize: 12, fontWeight: 600,
                  background: user?.role === "super_admin"
                    ? "color-mix(in oklab, var(--c-accent) 16%, var(--c-surface))"
                    : user?.role === "admin"
                    ? "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))"
                    : "var(--c-surface-2)",
                  color: user?.role === "super_admin"
                    ? "var(--c-accent)"
                    : user?.role === "admin"
                    ? "var(--c-primary)"
                    : "var(--c-text-muted)",
                }}>
                  {ROLE_LABEL[user?.role ?? "member"]}
                </div>
              </Field>
            </div>
          </div>

          {/* パスワード変更 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 4 }}>パスワード変更</h2>
            <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 12 }}>
              変更しない場合は空白のままにしてください
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="現在のパスワード">
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="現在のパスワード"
                  autoComplete="current-password"
                />
              </Field>
              <Field label="新しいパスワード（8文字以上）">
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="新しいパスワード"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="新しいパスワード（確認）">
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="新しいパスワード（再入力）"
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
