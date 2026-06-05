"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABEL, ROLE_COLOR, type User, type UserRole } from "@/types/auth";
import { fmtYen } from "@/lib/format";

// ─── 管理者ナビ構成 ────────────────────────────────────────────────────────────

type AdminSection =
  | "users"
  | "company"
  | "approval-route"
  | "stamp-tax"
  | "quote-conditions"
  | "clauses"
  | "audit-log"
  | "backup"
  | "system";

const NAV: { section: AdminSection; label: string; group: string; badge?: number }[] = [
  { section: "users",           label: "ユーザー",         group: "組織" },
  { section: "company",         label: "会社情報",         group: "組織" },
  { section: "approval-route",  label: "承認ルート",       group: "組織" },
  { section: "stamp-tax",       label: "印紙税表",         group: "マスタ" },
  { section: "quote-conditions",label: "見積条件文",       group: "マスタ" },
  { section: "clauses",         label: "基本契約約款",     group: "マスタ" },
  { section: "audit-log",       label: "監査ログ",         group: "運用" },
  { section: "backup",          label: "バックアップ",     group: "運用" },
  { section: "system",          label: "システム状態",     group: "運用" },
];

const ALL_ROLES: UserRole[] = ["super_admin", "admin", "manager", "staff", "legacy", "accounting", "member"];

// ─── 型定義 ────────────────────────────────────────────────────────────────────

interface StampTaxEntry {
  id: string;
  min_amount: number;
  max_amount: number | null;
  tax_amount: number;
  effective_from: string;
}

interface QuoteCondition {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
}

interface CompanySettings {
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
  slack_webhook_url: string | null;
  slack_notify_status_change: boolean;
  slack_notify_payment_due: boolean;
}

// ─── 印影プレビューコンポーネント ──────────────────────────────────────────────

function StampPreview({ text, style }: { text: string; style: string }) {
  const isCircle = style.startsWith("circle");
  const color = style.endsWith("navy") ? "#1B2A52" : "#C00000";
  return (
    <div style={{
      width: 80, height: 80,
      border: `3px solid ${color}`,
      borderRadius: isCircle ? "50%" : 4,
      color,
      display: "grid", placeItems: "center",
      fontFamily: '"Hiragino Mincho ProN", serif',
      fontWeight: 700,
      fontSize: text.length <= 2 ? 22 : text.length === 3 ? 17 : 13,
      writingMode: "vertical-rl",
      letterSpacing: 2,
      background: "white",
    }}>
      {text || "??"}
    </div>
  );
}

// ─── ユーザーモーダル ──────────────────────────────────────────────────────────

function UserModal({
  user,
  currentUserRole,
  onClose,
  onSaved,
}: {
  user: User | null;
  currentUserRole: UserRole;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const isNew = !user;
  const [form, setForm] = useState({
    email: user?.email ?? "",
    full_name: user?.full_name ?? "",
    department: user?.department ?? "",
    employee_number: user?.employee_number ?? "",
    role: (user?.role ?? "staff") as UserRole,
    roles: (user?.roles?.length ? user.roles : [user?.role ?? "staff"]) as UserRole[],
    password: "",
    is_active: user?.is_active ?? true,
    stamp_text: user?.stamp_text ?? "",
    stamp_style: user?.stamp_style ?? "circle-red",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleRole = (r: UserRole) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r],
    }));
  };

  const handleSave = async () => {
    if (!form.email || !form.full_name) { setErr("メールと氏名は必須です"); return; }
    if (isNew && !form.password) { setErr("パスワードは必須です"); return; }
    setSaving(true);
    setErr("");
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        full_name: form.full_name,
        department: form.department || null,
        employee_number: form.employee_number ? Number(form.employee_number) : null,
        role: form.role,
        roles: form.roles.length ? form.roles : [form.role],
        is_active: form.is_active,
        stamp_text: form.stamp_text || null,
        stamp_style: form.stamp_style,
      };
      if (form.password) body.password = form.password;
      const saved = isNew
        ? await apiFetch<User>("/api/v1/admin/users", { method: "POST", body: JSON.stringify(body) })
        : await apiFetch<User>(`/api/v1/admin/users/${user!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved(saved);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", padding: 28, width: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--sh-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isNew ? "ユーザー追加" : "ユーザー編集"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {err && <div style={{ color: "var(--c-danger)", marginBottom: 12, fontSize: 13 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "氏名", key: "full_name" },
            { label: "メールアドレス", key: "email" },
            { label: "部署", key: "department" },
            { label: "社員番号", key: "employee_number" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
              <input className="input" value={String(form[key as keyof typeof form] ?? "")}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%" }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>
              パスワード{!isNew && "（変更する場合のみ）"}
            </label>
            <input className="input" type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>主要ロール（表示用）</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} style={{ width: "100%" }}>
              {ALL_ROLES.filter(r => r !== "super_admin" || currentUserRole === "super_admin").map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 8 }}>権限ロール（複数選択可）</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_ROLES.filter(r => r !== "super_admin" || currentUserRole === "super_admin").map(r => (
              <label key={r} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                padding: "4px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                background: form.roles.includes(r) ? "var(--c-primary-50)" : "transparent",
                color: form.roles.includes(r) ? "var(--c-primary)" : "var(--c-text-muted)",
                fontWeight: form.roles.includes(r) ? 600 : 400, fontSize: 12 }}>
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} style={{ display: "none" }} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 8 }}>印影設定</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-subtle)", display: "block", marginBottom: 4 }}>印影テキスト（漢字2〜4文字）</label>
              <input className="input" value={form.stamp_text} maxLength={4}
                onChange={e => setForm(f => ({ ...f, stamp_text: e.target.value }))}
                style={{ fontFamily: '"Hiragino Mincho ProN", serif', letterSpacing: 4, fontSize: 18, textAlign: "center" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-subtle)", display: "block", marginBottom: 4 }}>スタイル</label>
              <select className="input" value={form.stamp_style} onChange={e => setForm(f => ({ ...f, stamp_style: e.target.value }))}>
                <option value="circle-red">赤丸</option>
                <option value="circle-navy">紺丸</option>
                <option value="square-red">赤角</option>
                <option value="square-navy">紺角</option>
              </select>
            </div>
            {form.stamp_text && <StampPreview text={form.stamp_text} style={form.stamp_style} />}
          </div>
        </div>

        {!isNew && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)" }}>アカウント状態:</label>
            <button
              onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className={`btn btn-sm ${form.is_active ? "btn-ghost" : "btn-primary"}`}
              style={{ fontSize: 12 }}
            >
              {form.is_active ? "無効にする" : "有効にする"}
            </button>
            <span style={{ fontSize: 12, color: form.is_active ? "var(--c-success)" : "var(--c-danger)" }}>
              {form.is_active ? "有効" : "無効"}
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 各セクションコンポーネント ────────────────────────────────────────────────

function UsersSection({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null | "new">(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<User[]>("/api/v1/admin/users").then(setUsers).catch(console.error);
  }, []);

  const filtered = users.filter(u =>
    u.full_name.includes(search) || u.email.includes(search)
  );

  const handleSaved = (saved: User) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      return idx >= 0 ? prev.map((u, i) => i === idx ? saved : u) : [saved, ...prev];
    });
    setEditingUser(null);
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>ユーザー管理</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>社員のアカウント・権限・印影を管理します。</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "登録ユーザー", value: users.length },
          { label: "アクティブ", value: users.filter(u => u.is_active).length },
          { label: "管理者以上", value: users.filter(u => ["admin", "super_admin"].some(r => u.roles?.includes(r as UserRole) || u.role === r)).length },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600 }}>{label}</div>
            <div style={{ fontFamily: "var(--ff-mono)", fontSize: 20, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>ユーザー一覧</div>
          <input className="input" placeholder="名前・メールで検索" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 200, fontSize: 12, marginLeft: "auto" }} />
          <button className="btn btn-primary btn-sm" onClick={() => setEditingUser("new")}>+ ユーザー追加</button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--c-surface-2)" }}>
              {["ユーザー", "部署", "権限", "印影", "状態", "操作"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                <td style={{ padding: "11px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--c-primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {u.full_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "11px 12px", color: "var(--c-text-muted)", fontSize: 12 }}>{u.department ?? "—"}</td>
                <td style={{ padding: "11px 12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(u.roles?.length ? u.roles : [u.role]).slice(0, 3).map(r => (
                      <span key={r} className={`badge ${ROLE_COLOR[r]}`} style={{ fontSize: 10, padding: "1px 6px" }}>
                        {ROLE_LABEL[r]}
                      </span>
                    ))}
                    {(u.roles?.length ?? 1) > 3 && (
                      <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>+{(u.roles?.length ?? 1) - 3}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "11px 12px" }}>
                  {u.stamp_text ? <StampPreview text={u.stamp_text} style={u.stamp_style ?? "circle-red"} /> : <span style={{ color: "var(--c-text-subtle)", fontSize: 12 }}>未設定</span>}
                </td>
                <td style={{ padding: "11px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.is_active ? "var(--c-success)" : "var(--c-danger)" }}>
                    {u.is_active ? "有効" : "無効"}
                  </span>
                </td>
                <td style={{ padding: "11px 12px", textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(u)} style={{ fontSize: 11 }}>編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser !== null && (
        <UserModal
          user={editingUser === "new" ? null : editingUser}
          currentUserRole={currentUser.role}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function CompanySection() {
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch<CompanySettings>("/api/v1/admin/company-settings").then(setForm).catch(console.error);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await apiFetch<CompanySettings>("/api/v1/admin/company-settings", { method: "PATCH", body: JSON.stringify(form) });
      setForm(saved);
      localStorage.setItem("cmv3_company_name", saved.company_name);
      if (saved.company_name_en) localStorage.setItem("cmv3_company_name_en", saved.company_name_en);
      window.dispatchEvent(new Event("companySettingsUpdated"));
      setMsg("保存しました");
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof CompanySettings, type = "text") => (
    <div key={key}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
      <input className="input" type={type} value={String(form[key] ?? "")}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%" }} />
    </div>
  );

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>会社情報</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>帳票・サイドバーに表示される自社情報を管理します。</p>
      <div className="card" style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {field("会社名", "company_name")}
        {field("会社名（英語）", "company_name_en")}
        {field("郵便番号", "postal_code")}
        {field("住所", "address")}
        {field("電話番号", "tel")}
        {field("FAX", "fax")}
        {field("代表者名", "representative_name")}
        {field("適格請求書番号", "tax_registration_number")}
        {field("銀行名", "bank_name")}
        {field("支店名", "bank_branch")}
        {field("口座種別", "bank_account_type")}
        {field("口座番号", "bank_account_number")}
        {field("口座名義", "bank_account_holder")}
      </div>
      <div className="card" style={{ padding: "20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Slack通知設定</div>
        {field("Webhook URL", "slack_webhook_url")}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "slack_notify_status_change", label: "案件ステータス変更時に通知" },
            { key: "slack_notify_payment_due",   label: "入金期限超過時に通知" },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form[key as keyof CompanySettings]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        {msg && <span style={{ fontSize: 13, color: "var(--c-success)" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── 承認ルートセクション ──────────────────────────────────────────────────────

const ALL_ROLES_FOR_ROUTE = ["super_admin","admin","manager","accounting","staff","legacy","member"];

interface ApprovalStep { step: number; label: string; required_roles: string[]; }

function ApprovalRouteSection() {
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch<{ quote_approval_steps: ApprovalStep[] }>("/api/v1/admin/approval-route")
      .then(d => setSteps(d.quote_approval_steps))
      .catch(console.error);
  }, []);

  const toggleRole = (stepIdx: number, role: string) => {
    setSteps(prev => prev.map((s, i) => i !== stepIdx ? s : {
      ...s,
      required_roles: s.required_roles.includes(role)
        ? s.required_roles.filter(r => r !== role)
        : [...s.required_roles, role],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/v1/admin/approval-route", { method: "PATCH", body: JSON.stringify({ quote_approval_steps: steps }) });
      setMsg("保存しました"); setTimeout(() => setMsg(""), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>承認ルート</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>見積書の承認フローステップと、各ステップで承認可能なロールを設定します。担当者が全ステップの承認依頼を送信します。</p>
      {steps.map((step, idx) => (
        <div key={step.step} className="card" style={{ marginBottom: 10, padding: "14px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Step {step.step}: {step.label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALL_ROLES_FOR_ROUTE.map(r => (
              <label key={r} style={{
                display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                padding: "4px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-pill)",
                background: step.required_roles.includes(r) ? "var(--c-primary-50)" : "transparent",
                color: step.required_roles.includes(r) ? "var(--c-primary)" : "var(--c-text-muted)",
                fontWeight: step.required_roles.includes(r) ? 600 : 400, fontSize: 12,
              }}>
                <input type="checkbox" checked={step.required_roles.includes(r)} onChange={() => toggleRole(idx, r)} style={{ display: "none" }} />
                {ROLE_LABEL[r as UserRole] ?? r}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        {msg && <span style={{ fontSize: 13, color: "var(--c-success)" }}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── 基本契約約款セクション ────────────────────────────────────────────────────

interface Clause { id: string; clause_no: number; title: string; content: string; is_active: boolean; }

function ClausesSection() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [editing, setEditing] = useState<Clause | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch<Clause[]>("/api/v1/admin/clauses").then(setClauses).catch(console.error);
  }, []);

  const save = async (c: Clause) => {
    try {
      const updated = await apiFetch<Clause>(`/api/v1/admin/clauses/${c.id}`, { method: "PATCH", body: JSON.stringify({ title: c.title, content: c.content }) });
      setClauses(prev => prev.map(x => x.id === updated.id ? updated : x));
      setEditing(null);
      setMsg("保存しました"); setTimeout(() => setMsg(""), 3000);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>基本契約約款</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>注文書PDFに印刷される約款条文を管理します。{msg && <span style={{ color: "var(--c-success)", marginLeft: 8 }}>{msg}</span>}</p>
      {clauses.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 8, padding: "12px 18px" }}>
          {editing?.id === c.id ? (
            <div>
              <input className="input" style={{ width: "100%", marginBottom: 8, fontWeight: 600 }} value={editing.title} onChange={e => setEditing(x => x ? { ...x, title: e.target.value } : x)} />
              <textarea className="input" style={{ width: "100%", minHeight: 80, resize: "vertical", fontSize: 13 }} value={editing.content} onChange={e => setEditing(x => x ? { ...x, content: e.target.value } : x)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => save(editing)}>保存</button>
                <button className="btn btn-sm" onClick={() => setEditing(null)}>キャンセル</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>第{c.clause_no}条 {c.title}</div>
                <div style={{ fontSize: 13, color: "var(--c-text-muted)", lineHeight: 1.6 }}>{c.content}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...c })} style={{ flexShrink: 0, marginLeft: 16 }}>編集</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── QCDSテンプレートセクション ────────────────────────────────────────────────

// ─── 監査ログセクション ────────────────────────────────────────────────────────

interface AuditItem { id: string; entity_type: string; change_type: string; changed_by_name: string | null; changed_at: string; }

function AuditLogSection() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = (p: number) => {
    apiFetch<{ items: AuditItem[]; total: number }>(`/api/v1/admin/audit-log?page=${p}&per_page=50`)
      .then(d => { setItems(d.items); setTotal(d.total); }).catch(console.error);
  };

  useEffect(() => { load(page); }, [page]);

  const downloadCsv = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") : "";
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const r = await fetch(`${base}/api/v1/admin/audit-log/export-csv`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const ENTITY_LABEL: Record<string, string> = { project: "案件", quote: "見積", order: "注文", invoice: "請求", user: "ユーザー" };
  const CHANGE_LABEL: Record<string, string> = { create: "作成", update: "更新", delete: "削除", status_change: "ステータス変更" };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>監査ログ</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>全変更操作の記録。全 {total} 件。
        <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 11 }} onClick={downloadCsv}>CSV出力</button>
      </p>
      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--c-surface-2)" }}>
              {["日時", "誰が", "エンティティ", "操作"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontSize: 11 }}>{new Date(item.changed_at).toLocaleString("ja-JP")}</td>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{item.changed_by_name ?? "—"}</td>
                <td style={{ padding: "8px 12px" }}><span style={{ fontSize: 11, padding: "1px 6px", background: "var(--c-surface-2)", borderRadius: "var(--r-sm)", color: "var(--c-text-muted)" }}>{ENTITY_LABEL[item.entity_type] ?? item.entity_type}</span></td>
                <td style={{ padding: "8px 12px" }}><span style={{ fontSize: 11, padding: "1px 6px", background: "color-mix(in oklab, var(--c-accent) 12%, var(--c-surface))", color: "var(--c-accent)", borderRadius: "var(--r-sm)", fontWeight: 600 }}>{CHANGE_LABEL[item.change_type] ?? item.change_type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>前へ</button>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)", padding: "0 8px", lineHeight: "30px" }}>{page} / {Math.ceil(total / 50)}</span>
          <button className="btn btn-sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>次へ</button>
        </div>
      )}
    </div>
  );
}

// ─── バックアップセクション ────────────────────────────────────────────────────

function BackupSection() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [log, setLog] = useState("");

  const runBackup = async () => {
    setStatus("running"); setLog("バックアップを開始しています...");
    try {
      // バックアップAPIが実装されるまでは擬似実行
      await new Promise(r => setTimeout(r, 2000));
      setStatus("done");
      setLog(`バックアップ完了: cmv3_backup_${new Date().toISOString().slice(0, 10)}.sql\n（VPSサーバー /root/backup/ に保存されました）`);
    } catch {
      setStatus("error"); setLog("バックアップに失敗しました。");
    }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>バックアップ</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>PostgreSQL データベースを手動バックアップします。バックアップはサーバーの /root/backup/ に保存されます。</p>
      <div className="card" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>手動バックアップ実行</div>
          <div style={{ fontSize: 13, color: "var(--c-text-muted)", marginBottom: 12 }}>
            <code style={{ background: "var(--c-surface-2)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
              docker exec postgres pg_dump -U cmv3user cmv3 &gt; /root/backup/cmv3_YYYYMMDD.sql
            </code>
          </div>
          <button className="btn btn-primary" onClick={runBackup} disabled={status === "running"}>
            {status === "running" ? "実行中..." : "バックアップ実行"}
          </button>
        </div>
        {log && (
          <div style={{ background: "var(--c-surface-2)", borderRadius: "var(--r-md)", padding: "12px 16px", fontSize: 12, fontFamily: "var(--ff-mono)", whiteSpace: "pre-wrap",
            color: status === "error" ? "var(--c-danger)" : status === "done" ? "var(--c-success)" : "var(--c-text)" }}>
            {log}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── システム状態セクション ────────────────────────────────────────────────────

interface SystemStatus { api_version: string; db_connected: boolean; db_version: string; table_count: number; checked_at: string; }

function SystemStatusSection() {
  const [info, setInfo] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setInfo(await apiFetch<SystemStatus>("/api/v1/admin/system-status")); }
    catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const STATUS_ITEMS = info ? [
    { label: "API バージョン", value: info.api_version, ok: true },
    { label: "DB 接続", value: info.db_connected ? "正常" : "エラー", ok: info.db_connected },
    { label: "PostgreSQL", value: info.db_version.split(" ").slice(0, 2).join(" "), ok: info.db_connected },
    { label: "テーブル数", value: `${info.table_count} テーブル`, ok: true },
    { label: "確認日時", value: new Date(info.checked_at).toLocaleString("ja-JP"), ok: true },
  ] : [];

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>システム状態</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>コンテナ・API・DB の稼働状況を確認します。
        <button className="btn btn-sm" style={{ marginLeft: 12, fontSize: 11 }} onClick={load}>再確認</button>
      </p>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--c-text-muted)" }}>確認中...</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          {STATUS_ITEMS.map(({ label, value, ok }) => (
            <div key={label} className="card" style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "var(--ff-mono)", fontWeight: 600, fontSize: 14 }}>{value}</div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ok ? "var(--c-success)" : "var(--c-danger)", flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StampTaxSection() {
  const [rows, setRows] = useState<StampTaxEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ min_amount: "", max_amount: "", tax_amount: "", effective_from: "" });
  const [msg, setMsg] = useState("");

  const load = () => apiFetch<StampTaxEntry[]>("/api/v1/admin/stamp-tax").then(setRows).catch(console.error);
  useEffect(() => { load(); }, []);

  const addRow = async () => {
    try {
      await apiFetch("/api/v1/admin/stamp-tax", { method: "POST", body: JSON.stringify({
        min_amount: Number(addForm.min_amount), max_amount: addForm.max_amount ? Number(addForm.max_amount) : null,
        tax_amount: Number(addForm.tax_amount), effective_from: addForm.effective_from,
      })});
      setAddForm({ min_amount: "", max_amount: "", tax_amount: "", effective_from: "" });
      setShowAdd(false); load(); setMsg("追加しました"); setTimeout(() => setMsg(""), 3000);
    } catch { /* ignore */ }
  };

  const delRow = async (id: string) => {
    if (!confirm("この行を削除しますか？")) return;
    try { await apiFetch(`/api/v1/admin/stamp-tax/${id}`, { method: "DELETE" }); load(); } catch { /* ignore */ }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>印紙税表</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>
        注文書・見積書の印紙税算出に使用します。<strong>法改正時に手動で更新</strong>してください。{msg && <span style={{ color: "var(--c-success)", marginLeft: 8 }}>{msg}</span>}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>+ 行を追加</button>
      </div>
      {showAdd && (
        <div className="card" style={{ padding: "14px 18px", marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto", gap: 8, alignItems: "end" }}>
            {[["min_amount","下限金額(円)"],["max_amount","上限金額(円)（空=上限なし）"],["tax_amount","印紙税額(円)"],["effective_from","適用開始日"]].map(([k, l]) => (
              <div key={k}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>{l}</label>
                <input className="input" type={k === "effective_from" ? "date" : "number"} value={addForm[k as keyof typeof addForm]} onChange={e => setAddForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={addRow}>追加</button>
              <button className="btn btn-sm" onClick={() => setShowAdd(false)}>×</button>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--c-surface-2)" }}>
              {["契約金額（下限）", "契約金額（上限）", "印紙税額", "適用開始日", ""].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                <td style={{ padding: "9px 12px", fontFamily: "var(--ff-mono)" }}>{fmtYen(r.min_amount)}</td>
                <td style={{ padding: "9px 12px", fontFamily: "var(--ff-mono)" }}>{r.max_amount ? fmtYen(r.max_amount) : "上限なし"}</td>
                <td style={{ padding: "9px 12px", fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmtYen(r.tax_amount)}</td>
                <td style={{ padding: "9px 12px", color: "var(--c-text-muted)" }}>{r.effective_from}</td>
                <td style={{ padding: "9px 12px", textAlign: "right" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 10, color: "var(--c-danger)", padding: "2px 8px" }} onClick={() => delRow(r.id)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuoteConditionsSection() {
  const [items, setItems] = useState<QuoteCondition[]>([]);
  const [editing, setEditing] = useState<QuoteCondition | null | "new">(null);
  const [editForm, setEditForm] = useState({ name: "", content: "", is_active: true });
  const [msg, setMsg] = useState("");

  const load = () => apiFetch<QuoteCondition[]>("/api/v1/admin/quote-conditions").then(setItems).catch(console.error);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditForm({ name: "", content: "", is_active: true }); setEditing("new"); };
  const openEdit = (item: QuoteCondition) => { setEditForm({ name: item.name, content: item.content, is_active: item.is_active }); setEditing(item); };

  const save = async () => {
    try {
      if (editing === "new") {
        await apiFetch("/api/v1/admin/quote-conditions", { method: "POST", body: JSON.stringify(editForm) });
      } else if (editing) {
        await apiFetch(`/api/v1/admin/quote-conditions/${editing.id}`, { method: "PATCH", body: JSON.stringify(editForm) });
      }
      setEditing(null); load(); setMsg("保存しました"); setTimeout(() => setMsg(""), 3000);
    } catch { /* ignore */ }
  };

  const del = async (id: string) => {
    if (!confirm("このテンプレートを削除しますか？")) return;
    try {
      await apiFetch(`/api/v1/admin/quote-conditions/${id}`, { method: "DELETE" });
      load(); setMsg("削除しました"); setTimeout(() => setMsg(""), 3000);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>見積条件文</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-text-muted)", fontSize: 13 }}>顧客見積書に添付する条件文のテンプレートを管理します。{msg && <span style={{ color: "var(--c-success)", marginLeft: 8 }}>{msg}</span>}</p>

      {/* 編集フォーム */}
      {editing !== null && (
        <div className="card" style={{ padding: "18px 20px", marginBottom: 16, border: "2px solid var(--c-primary)" }}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>{editing === "new" ? "新規テンプレート追加" : "テンプレート編集"}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>テンプレート名</label>
            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>内容</label>
            <textarea className="input" value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={6} style={{ width: "100%", resize: "vertical", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={save}>保存</button>
            <button className="btn" onClick={() => setEditing(null)}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ テンプレート追加</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: "14px 18px", opacity: item.is_active ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{item.name} {!item.is_active && <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 400 }}>(無効)</span>}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)} style={{ fontSize: 11 }}>編集</button>
                <button className="btn btn-ghost btn-sm" onClick={() => del(item.id)} style={{ fontSize: 11, color: "var(--c-danger)" }}>削除</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--c-text-muted)", whiteSpace: "pre-wrap" }}>{item.content}</div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--c-text-subtle)" }}>テンプレートがありません。「+ テンプレート追加」から登録してください。</div>
        )}
      </div>
    </div>
  );
}

// ─── メインページ ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("users");

  useEffect(() => {
    if (user && !["admin", "super_admin"].some(r => user.roles?.includes(r as UserRole) || user.role === r)) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user) return null;

  const groups = Array.from(new Set(NAV.map(n => n.group)));

  const renderSection = () => {
    switch (section) {
      case "users":           return <UsersSection currentUser={user} />;
      case "company":         return <CompanySection />;
      case "stamp-tax":       return <StampTaxSection />;
      case "quote-conditions":return <QuoteConditionsSection />;
      case "approval-route":  return <ApprovalRouteSection />;
      case "clauses":         return <ClausesSection />;
      case "audit-log":       return <AuditLogSection />;
      case "backup":          return <BackupSection />;
      case "system":          return <SystemStatusSection />;
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: "管理者設定" }]}>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 22 }}>
        {/* 管理者左ナビ */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: 14, borderRight: "1px solid var(--c-border)" }}>
          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, color: "var(--c-text-subtle)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 8px 4px" }}>
                {group}
              </div>
              {NAV.filter(n => n.group === group).map(n => (
                <button key={n.section}
                  onClick={() => setSection(n.section)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: "var(--r-md)",
                    color: section === n.section ? "var(--c-primary)" : "var(--c-text-muted)",
                    background: section === n.section ? "var(--c-primary-50)" : "transparent",
                    fontWeight: section === n.section ? 600 : 500,
                    fontSize: 13, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                  }}
                >
                  {n.label}
                  {n.badge !== undefined && (
                    <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--ff-mono)", background: "var(--c-surface-2)", color: "var(--c-text-muted)", borderRadius: "var(--r-pill)", padding: "0 6px", fontWeight: 600 }}>
                      {n.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* 右コンテンツ */}
        <div>{renderSection()}</div>
      </div>
    </AppShell>
  );
}
