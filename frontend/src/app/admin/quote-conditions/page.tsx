"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Template {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

/** 見積条件テンプレート管理画面（管理者専用）。 */
export default function QuoteConditionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "super_admin") router.replace("/projects");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") load();
  }, [authLoading, user]);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await apiFetch<Template[]>("/api/v1/admin/quote-conditions"));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function select(t: Template) {
    setSelected(t); setName(t.name); setContent(t.content); setIsActive(t.is_active);
  }

  function clearForm() {
    setSelected(null); setName(""); setContent(""); setIsActive(true);
  }

  async function handleSave() {
    if (!name || !content) { setMsg("名称と内容は必須です"); return; }
    setSaving(true); setMsg(null);
    const body = { name, content, is_active: isActive };
    try {
      if (selected) {
        await apiFetch(`/api/v1/admin/quote-conditions/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/v1/admin/quote-conditions", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setMsg("保存しました"); clearForm(); await load();
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    try {
      await apiFetch(`/api/v1/admin/quote-conditions/${id}`, { method: "DELETE" });
      if (selected?.id === id) clearForm();
      await load();
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`);
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "設定" }, { label: "見積条件テンプレート" }]}>
      <div className="toolbar">
        <h1>見積条件テンプレート</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12 }}>
        {/* 左: テンプレート一覧 */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--c-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text)" }}>テンプレート一覧</span>
            <button
              onClick={clearForm}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-primary)", padding: 2 }}
              title="新規作成"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--c-text-muted)", fontSize: 13 }}>
              読み込み中…
            </div>
          ) : templates.length === 0 ? (
            <p style={{ padding: "16px", fontSize: 12, color: "var(--c-text-muted)", textAlign: "center" }}>
              テンプレートがありません
            </p>
          ) : (
            <div>
              {templates.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex", alignItems: "center",
                    borderBottom: "1px solid var(--c-border)",
                    background: selected?.id === t.id ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))" : undefined,
                  }}
                >
                  <button
                    onClick={() => select(t)}
                    style={{
                      flex: 1, textAlign: "left", padding: "10px 12px",
                      background: "none", border: "none", cursor: "pointer",
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--c-text)" }}>{t.name}</p>
                    <span style={{ fontSize: 11, color: t.is_active ? "var(--c-success)" : "var(--c-text-muted)" }}>
                      {t.is_active ? "有効" : "無効"}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--c-danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--c-text-muted)")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右: 編集フォーム */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>
              {selected ? "テンプレート編集" : "新規テンプレート"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {msg && (
                <span style={{ fontSize: 13, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
                  {msg}
                </span>
              )}
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
                テンプレート名
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="標準条件 / 官公庁向け / 等"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>
                内容
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="見積条件の本文を入力…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--c-surface)",
                  color: "var(--c-text)",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontFamily: "var(--ff-mono)",
                  resize: "vertical",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--c-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--c-border)")}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ accentColor: "var(--c-primary)" }}
              />
              <span style={{ color: "var(--c-text)" }}>有効（新規見積で選択肢に表示）</span>
            </label>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
