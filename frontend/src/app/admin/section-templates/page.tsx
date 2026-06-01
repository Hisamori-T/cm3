"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface TemplateItem {
  id?: string;
  section_code: string;
  section_name: string;
  display_order: number;
  default_items: null;
}

interface SectionTemplate {
  id: string;
  template_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  items: TemplateItem[];
}

// ---------------------------------------------------------------------------
// 編集フォームコンポーネント
// ---------------------------------------------------------------------------

interface EditFormProps {
  initial: Partial<SectionTemplate> | null;
  onSave: (name: string, description: string, items: TemplateItem[]) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EditForm({ initial, onSave, onCancel, saving }: EditFormProps) {
  const [name, setName] = useState(initial?.template_name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [items, setItems] = useState<TemplateItem[]>(
    initial?.items?.map((i, idx) => ({ ...i, display_order: i.display_order || idx + 1 })) || []
  );

  const addItem = () => {
    const maxOrder = Math.max(0, ...items.map(i => i.display_order));
    setItems([...items, { section_code: "", section_name: "", display_order: maxOrder + 1, default_items: null }]);
  };

  const updateItem = (idx: number, field: keyof TemplateItem, value: string | number) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        {initial?.id ? "テンプレートを編集" : "テンプレートを新規作成"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>テンプレート名 *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="仲都型・改修型 等" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>説明</label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="用途・対象工事など" />
        </div>
      </div>

      {/* 大項目構成 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 6 }}>大項目構成</div>
        {items.length === 0 ? (
          <div style={{ padding: "12px 0", textAlign: "center", color: "var(--c-text-muted)", fontSize: 12 }}>
            大項目がありません
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["順序", "記号", "大項目名", ""].map((h, i) => (
                  <th key={i} style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--c-text-muted)", textAlign: "left", borderBottom: "1px solid var(--c-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "3px 4px", width: 52 }}>
                    <input
                      type="number"
                      value={item.display_order}
                      onChange={e => updateItem(idx, "display_order", parseInt(e.target.value) || 1)}
                      style={{
                        width: "100%", padding: "3px 6px", fontSize: 12, textAlign: "center",
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)",
                      }}
                    />
                  </td>
                  <td style={{ padding: "3px 4px", width: 52 }}>
                    <input
                      value={item.section_code}
                      onChange={e => updateItem(idx, "section_code", e.target.value.toUpperCase().slice(0, 3))}
                      placeholder="A"
                      style={{
                        width: "100%", padding: "3px 6px", fontSize: 13, fontWeight: 700, textAlign: "center",
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)",
                      }}
                    />
                  </td>
                  <td style={{ padding: "3px 4px" }}>
                    <input
                      value={item.section_name}
                      onChange={e => updateItem(idx, "section_name", e.target.value)}
                      placeholder="大項目名（例：建築工事）"
                      style={{
                        width: "100%", padding: "3px 8px", fontSize: 12,
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                        background: "var(--c-surface)",
                      }}
                    />
                  </td>
                  <td style={{ padding: "3px 4px", width: 28 }}>
                    <button
                      onClick={() => removeItem(idx)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", display: "flex" }}
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={addItem}
          style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "var(--c-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Plus size={12} /> 大項目を追加
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="default" size="sm" onClick={onCancel} disabled={saving}>
          キャンセル
        </Button>
        <Button
          variant="default" size="sm"
          onClick={() => onSave(name, desc, items.sort((a, b) => a.display_order - b.display_order))}
          disabled={!name || saving}
          style={{ background: "var(--c-primary)", color: "#fff" }}
        >
          <Save size={13} /> {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ページ本体
// ---------------------------------------------------------------------------

/** 大項目テンプレート管理画面（管理者専用）。 */
export default function SectionTemplatesAdminPage() {
  const [templates, setTemplates] = useState<SectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<SectionTemplate | null | "new">(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await apiFetch<SectionTemplate[]>("/api/v1/section-templates/all");
      setTemplates(data);
    } catch {
      setMsg("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

  async function handleSave(name: string, description: string, items: TemplateItem[]) {
    setSaving(true);
    try {
      const body = {
        template_name: name,
        description: description || null,
        items: items.map(i => ({
          section_code: i.section_code,
          section_name: i.section_name,
          display_order: i.display_order,
          default_items: null,
        })),
      };
      if (editing && editing !== "new") {
        await apiFetch(`/api/v1/section-templates/${(editing as SectionTemplate).id}`, {
          method: "PATCH", body: JSON.stringify(body),
        });
        showMsg("更新しました");
      } else {
        await apiFetch("/api/v1/section-templates", {
          method: "POST", body: JSON.stringify(body),
        });
        showMsg("作成しました");
      }
      setEditing(null);
      await loadTemplates();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(t: SectionTemplate) {
    try {
      await apiFetch(`/api/v1/section-templates/${t.id}`, {
        method: "PATCH", body: JSON.stringify({ is_active: !t.is_active }),
      });
      await loadTemplates();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleDelete(t: SectionTemplate) {
    if (!confirm(`「${t.template_name}」を削除しますか？`)) return;
    try {
      await apiFetch(`/api/v1/section-templates/${t.id}`, { method: "DELETE" });
      await loadTemplates();
      showMsg("削除しました");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  return (
    <AppShell
      breadcrumbs={[{ label: "大項目テンプレート管理" }]}
      action={
        editing ? null : (
          <Button
            variant="default" size="sm"
            onClick={() => setEditing("new")}
            style={{ background: "var(--c-primary)", color: "#fff" }}
          >
            <Plus className="w-3.5 h-3.5" /> 新規作成
          </Button>
        )
      }
    >
      <div className="toolbar">
        <h1>大項目テンプレート管理</h1>
      </div>

      {msg && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 13,
          background: msg.startsWith("エラー") ? "var(--c-danger-bg)" : "color-mix(in oklab, var(--c-success) 10%, var(--c-surface))",
          color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)",
          border: "1px solid currentColor",
        }}>
          {msg}
        </div>
      )}

      {/* 編集フォーム */}
      {editing !== null && (
        <EditForm
          initial={editing === "new" ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* 一覧 */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--c-text-muted)", fontSize: 13 }}>
          テンプレートがありません。「新規作成」で追加してください。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ padding: "12px 16px", opacity: t.is_active ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: t.items.length > 0 ? 8 : 0 }}>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{t.template_name}</span>
                {t.description && (
                  <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{t.description}</span>
                )}
                <span style={{
                  padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: 11, fontWeight: 600,
                  background: t.is_active ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))" : "var(--c-surface-2)",
                  color: t.is_active ? "var(--c-success)" : "var(--c-text-muted)",
                }}>
                  {t.is_active ? "有効" : "無効"}
                </span>
                <button
                  onClick={() => setEditing(t)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-primary)", display: "flex", padding: 4 }}
                  title="編集"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleToggleActive(t)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", display: "flex", padding: 4, fontSize: 11 }}
                  title={t.is_active ? "無効にする" : "有効にする"}
                >
                  {t.is_active ? "無効化" : "有効化"}
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", display: "flex", padding: 4 }}
                  title="削除"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {t.items.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {t.items.map((item, idx) => (
                    <span key={idx} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: "var(--r-pill)", fontSize: 11,
                      background: "var(--c-surface-2)", color: "var(--c-text)",
                    }}>
                      <span style={{ fontWeight: 700, color: "var(--c-primary)" }}>{item.section_code}</span>
                      {item.section_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
