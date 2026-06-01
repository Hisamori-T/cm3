"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/layout/AppShell";

// ── 型定義 ──────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  full_name: string;
  employee_number: number | null;
  role: string;
  department: string | null;
  is_active: boolean;
}

interface UserForm {
  email: string;
  full_name: string;
  password: string;
  employee_number: string;
  role: string;
  department: string;
}

const EMPTY_FORM: UserForm = {
  email: "",
  full_name: "",
  password: "",
  employee_number: "",
  role: "staff",
  department: "",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "システム管理者",
  admin: "管理者",
  manager: "上長",
  staff: "現場・営業",
  legacy: "Excel専用",
  accounting: "経理担当",
  member: "メンバー（旧）",
};

const ROLE_STYLE: Record<string, React.CSSProperties> = {
  super_admin: { background: "color-mix(in oklab, var(--c-accent) 16%, var(--c-surface))", color: "var(--c-accent)" },
  admin: { background: "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))", color: "var(--c-primary)" },
  manager: { background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))", color: "#7c5cbf" },
  staff: { background: "color-mix(in oklab, var(--c-success) 12%, var(--c-surface))", color: "var(--c-success)" },
  legacy: { background: "var(--c-warn-bg)", color: "#b45309" },
  accounting: { background: "color-mix(in oklab, var(--c-info) 12%, var(--c-surface))", color: "var(--c-info)" },
  member: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
};

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function UserFormModal({
  initial,
  isNew,
  onClose,
  onSave,
  canAssignSuperAdmin,
}: {
  initial: UserForm;
  isNew: boolean;
  onClose: () => void;
  onSave: (form: UserForm) => Promise<void>;
  canAssignSuperAdmin: boolean;
}) {
  const [form, setForm] = useState<UserForm>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!form.email || !form.full_name) {
      setErr("メールと氏名は必須です");
      return;
    }
    if (isNew && !form.password) {
      setErr("新規作成時はパスワードが必須です");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr("このメールアドレスは既に使用されています");
      } else {
        setErr("保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isNew ? "ユーザー追加" : "ユーザー編集"}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {err && <p className="text-xs text-[var(--color-error)] bg-red-50 rounded px-2 py-1">{err}</p>}

        <div className="space-y-3">
          {[
            { label: "氏名 *", key: "full_name" as const, type: "text" },
            { label: "メールアドレス *", key: "email" as const, type: "email" },
            { label: isNew ? "パスワード *" : "パスワード（変更時のみ）", key: "password" as const, type: "password" },
            { label: "社員番号", key: "employee_number" as const, type: "number" },
            { label: "部署", key: "department" as const, type: "text" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
              <Input type={type} value={form[key]} onChange={set(key)} className="h-8 text-sm" />
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-xs text-[var(--color-text-secondary)]">権限</label>
            <select
              value={form.role}
              onChange={set("role")}
              className="w-full h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {canAssignSuperAdmin && <option value="super_admin">システム管理者</option>}
              <option value="admin">管理者</option>
              <option value="manager">上長</option>
              <option value="staff">現場・営業</option>
              <option value="legacy">Excel専用</option>
              <option value="accounting">経理担当</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="default" size="sm" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

/** ユーザー管理画面（管理者専用）。 */
export default function AdminUsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<UserData | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
    if (!authLoading && user && user.role !== "admin" && user.role !== "super_admin") router.replace("/projects");
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiFetch<UserData[]>("/api/v1/admin/users");
      setUsers(list);
    } catch {
      setError("ユーザー一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && (user?.role === "admin" || user?.role === "super_admin")) load();
  }, [authLoading, user, load]);

  const openCreate = () => {
    setEditTarget(null);
    setShowModal(true);
  };

  const openEdit = (u: UserData) => {
    setEditTarget(u);
    setShowModal(true);
  };

  const handleSave = async (form: UserForm) => {
    if (editTarget) {
      const body: Record<string, unknown> = {
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        department: form.department || null,
        employee_number: form.employee_number ? Number(form.employee_number) : null,
      };
      if (form.password) body.password = form.password;
      await apiFetch(`/api/v1/admin/users/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          full_name: form.full_name,
          password: form.password,
          role: form.role,
          department: form.department || null,
          employee_number: form.employee_number ? Number(form.employee_number) : null,
        }),
      });
    }
    setShowModal(false);
    await load();
  };

  const toggleActive = async (u: UserData) => {
    if (togglingId) return;
    setTogglingId(u.id);
    try {
      await apiFetch(`/api/v1/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      await load();
    } catch {
      setError("状態の変更に失敗しました");
    } finally {
      setTogglingId(null);
    }
  };

  const getInitialForm = (): UserForm => {
    if (!editTarget) return EMPTY_FORM;
    return {
      email: editTarget.email,
      full_name: editTarget.full_name,
      password: "",
      employee_number: editTarget.employee_number?.toString() ?? "",
      role: editTarget.role,
      department: editTarget.department ?? "",
    };
  };

  return (
    <AppShell
      breadcrumbs={[{ label: "設定" }, { label: "ユーザー管理" }]}
      action={
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />
          ユーザー追加
        </Button>
      }
    >
      <div className="toolbar">
        <h1>ユーザー管理</h1>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--c-danger-bg)", border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))", borderRadius: "var(--r-md)", fontSize: 13, color: "var(--c-danger)" }}>
          {error}
        </div>
      )}

      {(authLoading || isLoading) ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)", fontSize: 13 }}>読み込み中...</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                {["社員番号", "氏名", "メールアドレス", "権限", "部署", "状態", "操作"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <td className="num" style={{ fontSize: 12 }}>{u.employee_number ?? "—"}</td>
                  <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ color: "var(--c-text-muted)" }}>{u.email}</td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "2px 8px", borderRadius: "var(--r-pill)",
                      fontSize: 11, fontWeight: 600,
                      ...(ROLE_STYLE[u.role] ?? ROLE_STYLE.member),
                    }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ color: "var(--c-text-muted)" }}>{u.department ?? "—"}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={togglingId === u.id || (user != null && u.id === user.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, background: "none", border: "none", cursor: "pointer", opacity: (togglingId === u.id || (user != null && u.id === user.id)) ? 0.4 : 1 }}
                    >
                      {u.is_active ? (
                        <Check className="w-3.5 h-3.5" style={{ color: "var(--c-success)" }} />
                      ) : (
                        <X className="w-3.5 h-3.5" style={{ color: "var(--c-text-muted)" }} />
                      )}
                      {u.is_active ? "有効" : "無効"}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => openEdit(u)}
                      style={{ padding: "4px", borderRadius: "var(--r-md)", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)" }}>
                    ユーザーが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserFormModal
          initial={getInitialForm()}
          isNew={!editTarget}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          canAssignSuperAdmin={user?.role === "super_admin"}
        />
      )}
    </AppShell>
  );
}
