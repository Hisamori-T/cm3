"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api-client";
import { AppShell } from "@/components/layout/AppShell";

interface CompanySettings {
  id: string;
  company_name: string;
  company_name_en: string | null;
  postal_code: string | null;
  address: string | null;
  tel: string | null;
  fax: string | null;
  representative_name: string | null;
  tax_registration_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  seal_text: string | null;
  logo_text: string | null;
  notes: string | null;
  slack_webhook_url: string | null;
  slack_notify_status_change: boolean;
  slack_notify_payment_due: boolean;
}

const FIELD_DEFS: Array<{
  key: keyof CompanySettings;
  label: string;
  section?: string;
}> = [
  { key: "company_name", label: "会社名 *", section: "基本情報" },
  { key: "company_name_en", label: "会社名（英語）" },
  { key: "representative_name", label: "代表者名" },
  { key: "postal_code", label: "郵便番号", section: "住所・連絡先" },
  { key: "address", label: "住所" },
  { key: "tel", label: "TEL" },
  { key: "fax", label: "FAX" },
  { key: "tax_registration_number", label: "登録番号（適格請求書）", section: "税務情報" },
  { key: "bank_name", label: "銀行名", section: "振込先" },
  { key: "bank_branch", label: "支店名" },
  { key: "bank_account_type", label: "口座種別" },
  { key: "bank_account_number", label: "口座番号" },
  { key: "bank_account_holder", label: "口座名義" },
];

const EMPTY: CompanySettings = {
  id: "default",
  company_name: "",
  company_name_en: null,
  postal_code: null,
  address: null,
  tel: null,
  fax: null,
  representative_name: null,
  tax_registration_number: null,
  bank_name: null,
  bank_branch: null,
  bank_account_type: null,
  bank_account_number: null,
  bank_account_holder: null,
  seal_text: null,
  logo_text: null,
  notes: null,
  slack_webhook_url: null,
  slack_notify_status_change: true,
  slack_notify_payment_due: true,
};

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    apiFetch<CompanySettings>("/api/v1/company-settings")
      .then(setData)
      .catch(() => setMsg({ type: "err", text: "読み込みに失敗しました" }))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((p) => ({ ...p, [key]: e.target.value || null }));

  const handleSave = async () => {
    if (!data.company_name) {
      setMsg({ type: "err", text: "会社名は必須です" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const updated = await apiFetch<CompanySettings>("/api/v1/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setData(updated);
      // AppShell のサイドバーをリアルタイム更新
      localStorage.setItem("cmv3_company_name", updated.company_name);
      localStorage.setItem("cmv3_company_name_en", updated.company_name_en ?? "");
      localStorage.setItem("cmv3_logo_text", updated.logo_text ?? "");
      window.dispatchEvent(new Event("companySettingsUpdated"));
      setMsg({ type: "ok", text: "保存しました" });
    } catch {
      setMsg({ type: "err", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (editable: boolean) =>
    `w-full h-9 rounded border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)] ${
      editable
        ? "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]"
        : "border-transparent bg-[var(--c-surface-2)] text-[var(--c-text-muted)] cursor-not-allowed"
    }`;

  let currentSection = "";

  return (
    <AppShell
      breadcrumbs={[{ label: "管理", href: "/admin/users" }, { label: "自社情報設定" }]}
    >
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} color="var(--c-primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)" }}>自社情報設定</h1>
            <p style={{ fontSize: 12, color: "var(--c-text-muted)" }}>帳票（見積書・注文書・請求書）に印刷される自社情報を管理します</p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--c-text-muted)", fontSize: 14 }}>読み込み中...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {FIELD_DEFS.map((def) => {
              const showSection = def.section && def.section !== currentSection;
              if (def.section) currentSection = def.section;
              const val = data[def.key] ?? "";
              return (
                <div key={def.key}>
                  {showSection && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--c-text-muted)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "20px 0 8px",
                        borderBottom: "1px solid var(--c-border)",
                        marginBottom: 12,
                      }}
                    >
                      {def.section}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      alignItems: "center",
                      gap: 12,
                      padding: "6px 0",
                    }}
                  >
                    <label style={{ fontSize: 13, color: "var(--c-text-muted)" }}>{def.label}</label>
                    <input
                      className={inputCls(isAdmin)}
                      value={val as string}
                      onChange={set(def.key)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              );
            })}

            {/* サイドバーアイコン文字 */}
            <div
              style={{
                fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)",
                letterSpacing: "0.06em", textTransform: "uppercase",
                padding: "20px 0 8px", borderBottom: "1px solid var(--c-border)", marginBottom: 12,
              }}
            >
              帳票設定
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 12, padding: "6px 0" }}>
              <label style={{ fontSize: 13, color: "var(--c-text-muted)" }}>
                サイドバーアイコン文字<br />
                <span style={{ fontSize: 10, color: "var(--c-text-muted)", fontWeight: 400 }}>
                  最大2文字。空欄なら英語名を自動使用
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  className={inputCls(isAdmin)}
                  value={data.logo_text ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 2);
                    setData((p) => ({ ...p, logo_text: v || null }));
                  }}
                  disabled={!isAdmin}
                  maxLength={2}
                  style={{ width: 80 }}
                />
                {/* プレビュー */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--c-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.04em",
                  flexShrink: 0,
                }}>
                  {data.logo_text?.trim().toUpperCase() ||
                    (data.company_name_en?.trim().slice(0, 2).toUpperCase()) ||
                    data.company_name.replace(/[株式会社（）【】\s]/g, "").slice(0, 2) ||
                    "CL"}
                </div>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>← プレビュー</span>
              </div>
            </div>

            {/* 備考 */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--c-text-muted)",
                  letterSpacing: "0.06em",
                  padding: "20px 0 8px",
                  borderBottom: "1px solid var(--c-border)",
                  marginBottom: 12,
                }}
              >
                備考
              </div>
              <textarea
                rows={3}
                className={`w-full rounded border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)] ${
                  isAdmin
                    ? "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]"
                    : "border-transparent bg-[var(--c-surface-2)] text-[var(--c-text-muted)] cursor-not-allowed"
                }`}
                value={data.notes ?? ""}
                onChange={set("notes")}
                disabled={!isAdmin}
                placeholder="その他補足情報"
              />

              {/* Slack通知設定 */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>🔔</span> Slack通知設定
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
                      Slack Webhook URL
                      <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 11, color: "var(--c-primary)" }}>設定方法 ↗</a>
                    </div>
                    <input
                      type="text"
                      className="w-full rounded border px-3 py-2 text-sm"
                      style={{ border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text)" }}
                      value={data.slack_webhook_url ?? ""}
                      onChange={(e) => setData((d) => ({ ...d, slack_webhook_url: e.target.value || null }))}
                      disabled={!isAdmin}
                      placeholder="https://hooks.slack.com/services/xxx/yyy/zzz"
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { key: "slack_notify_status_change" as const, label: "案件ステータス変更時に通知" },
                      { key: "slack_notify_payment_due"   as const, label: "入金期限超過時に通知" },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: isAdmin ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          checked={!!data[key]}
                          onChange={(e) => setData((d) => ({ ...d, [key]: e.target.checked }))}
                          disabled={!isAdmin}
                          style={{ width: 16, height: 16, accentColor: "var(--c-primary)" }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* フィードバック */}
        {msg && (
          <div
            style={{
              marginTop: 16,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              background: msg.type === "ok" ? "color-mix(in oklab, var(--c-success) 12%, var(--c-surface))" : "color-mix(in oklab, red 10%, var(--c-surface))",
              color: msg.type === "ok" ? "var(--c-success)" : "#dc2626",
            }}
          >
            {msg.text}
          </div>
        )}

        {/* 保存ボタン（管理者のみ表示） */}
        {isAdmin && (
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                borderRadius: 6,
                background: "var(--c-primary)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Save size={14} />
              {saving ? "保存中..." : "保存する"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
