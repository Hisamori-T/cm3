"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Download, ArrowDownToLine, X, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen } from "@/lib/format";
import {
  SectionBlock,
  type QuoteSection,
  type QuoteItem,
} from "@/modules/estimate/SectionBlock";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface QuoteVersion {
  id: string;
  version_no: number;
  vendor_name_snapshot: string | null;
  markup_rate: number;
  is_active: boolean;
}

interface QuoteDetail {
  id: string;
  project_id: string;
  quote_number: string | null;
  issue_date: string | null;
  validity_days: number;
  project_name_snapshot: string | null;
  project_location_snapshot: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_condition: string | null;
  remarks: string | null;
  conditions_text: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  discount_amount: number | null;
  approver_id: string | null;
  approved_at: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  person_in_charge_id: string | null;
  person_in_charge_confirmed_at: string | null;
  status: string;
  versions: QuoteVersion[];
  sections: QuoteSection[];
  items: QuoteItem[];
}

interface SectionTemplate {
  id: string;
  template_name: string;
  items: { section_code: string; section_name: string; display_order: number }[];
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

interface QCDSCalc {
  total_cost: number;
}
interface QCDSSummary {
  id: string;
  calc: QCDSCalc;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : "";
const fmt = fmtYen;


// ---------------------------------------------------------------------------
// ページ本体
// ---------------------------------------------------------------------------

/** 見積書 詳細エディタ。大項目・明細のインライン編集、テンプレ適用、Excel出力。 */
export default function QuoteDetailPage() {
  const { id: projectId, quote_id: quoteId } = useParams<{ id: string; quote_id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [qcds, setQcds] = useState<QCDSSummary | null | "none">(null);
  const [templates, setTemplates] = useState<SectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [addSectionLetter, setAddSectionLetter] = useState("");
  const [addSectionName, setAddSectionName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // 選択削除
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectedCount = selectedItemIds.size + selectedSectionIds.size;

  // 業者見積から取り込みモーダル
  const [importOpen, setImportOpen] = useState(false);

  // 値引き編集
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  // 承認スタンプ
  const [stampUsers, setStampUsers] = useState<UserOption[]>([]);
  const [stampTarget, setStampTarget] = useState<"person_in_charge" | "reviewer" | "approver" | null>(null);
  const [stampLoading, setStampLoading] = useState(false);

  // ── データ取得 ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, tmplList] = await Promise.all([
        apiFetch<QuoteDetail>(`/api/v1/projects/${projectId}/quotes/${quoteId}`),
        apiFetch<SectionTemplate[]>("/api/v1/section-templates"),
      ]);
      setQuote(detail);
      setTemplates(tmplList);
      // QCDSから原価を取得（404なら未作成）
      apiFetch<QCDSSummary>(`/api/v1/projects/${projectId}/qcds`)
        .then(q => setQcds(q))
        .catch(() => setQcds("none"));
    } catch {
      setMsg("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, quoteId]);

  useEffect(() => { load(); }, [load]);

  // ユーザー一覧を読み込み（承認スタンプ選択用）
  useEffect(() => {
    apiFetch<UserOption[]>("/api/v1/auth/users").then(setStampUsers).catch(() => {});
  }, []);

  // 承認スタンプ押印
  const handleStamp = async (stampType: "person_in_charge" | "reviewer" | "approver", userId: string, stamp: boolean) => {
    if (!quote) return;
    setStampLoading(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/approve`, {
        method: "POST",
        body: JSON.stringify({ stamp_type: stampType, user_id: userId, stamp }),
      });
      setStampTarget(null);
      await load();
    } catch (e) {
      showMsg(`押印失敗: ${(e as Error).message}`);
    } finally {
      setStampLoading(false);
    }
  };

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 3000);
  };

  // ── 大項目操作 ────────────────────────────────────────────────────────────
  const handleAddSection = async () => {
    if (!quote || !addSectionLetter || !addSectionName) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/sections`, {
        method: "POST",
        body: JSON.stringify({
          section_letter: addSectionLetter.toUpperCase().slice(0, 3),
          section_name: addSectionName,
          row_no: (quote.sections.length + 1),
        }),
      });
      setAddSectionLetter("");
      setAddSectionName("");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("この大項目を削除しますか？（所属する明細の大項目割り当ても解除されます）")) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/sections/${sectionId}`, { method: "DELETE" });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  const handleUpdateSection = async (sectionId: string, letter: string, name: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/sections/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ section_letter: letter, section_name: name }),
      });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  // ── テンプレ適用 ──────────────────────────────────────────────────────────
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/apply-template`, {
        method: "POST",
        body: JSON.stringify({ template_id: selectedTemplate }),
      });
      setSelectedTemplate("");
      await load();
      showMsg("テンプレートを適用しました");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  // ── 明細操作 ──────────────────────────────────────────────────────────────
  const handleUpdateItem = async (item: QuoteItem) => {
    setSaving(true);
    try {
      const updated = await apiFetch<QuoteItem>(`/api/v1/projects/${projectId}/quotes/${quoteId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          row_no: item.row_no,
          section_id: item.section_id,
          version_id: item.version_id,
          item_name: item.item_name,
          spec: item.spec,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          remarks: item.remarks,
        }),
      });
      // load() を呼ばずローカルステートのみ更新してスクロール位置を保持
      setQuote(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === item.id ? { ...i, ...updated } : i),
      } : prev);
    } catch (e) { showMsg(`保存エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/items/${itemId}`, { method: "DELETE" });
      setQuote(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
      } : prev);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  const handleAddItem = async (sectionId: string) => {
    if (!quote) return;
    setSaving(true);
    const maxRow = Math.max(0, ...quote.items.map(i => i.row_no));
    try {
      const newItem = await apiFetch<QuoteItem>(`/api/v1/projects/${projectId}/quotes/${quoteId}/items`, {
        method: "POST",
        body: JSON.stringify({ row_no: maxRow + 1, section_id: sectionId || null }),
      });
      setQuote(prev => prev ? {
        ...prev,
        items: [...prev.items, newItem],
      } : prev);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  // ── 一括削除 ─────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    const itemCount = selectedItemIds.size;
    const secCount = selectedSectionIds.size;
    if (itemCount === 0 && secCount === 0) return;
    if (!confirm(`明細 ${itemCount} 件、大項目 ${secCount} 件を削除しますか？`)) return;
    setBulkDeleting(true);
    try {
      // 明細を先に削除
      for (const id of Array.from(selectedItemIds)) {
        await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/items/${id}`, { method: "DELETE" });
      }
      // 大項目を削除
      for (const id of Array.from(selectedSectionIds)) {
        await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/sections/${id}`, { method: "DELETE" });
      }
      setSelectedItemIds(new Set());
      setSelectedSectionIds(new Set());
      await load();
    } catch (e) { showMsg(`削除エラー: ${(e as Error).message}`); }
    finally { setBulkDeleting(false); }
  };

  // ── 業者見積から取り込み ───────────────────────────────────────────────────
  const handleImportFromEstimate = async (versionId: string, targetSectionId: string | null) => {
    if (!quote) return;
    setSaving(true);
    try {
      const versionItems = quote.items
        .filter(i => i.version_id === versionId)
        .sort((a, b) => a.row_no - b.row_no);
      const version = quote.versions.find(v => v.id === versionId);
      const markupRate = version?.markup_rate ?? 1.0;
      const maxRow = Math.max(0, ...quote.items.filter(i => !i.version_id).map(i => i.row_no));
      let offset = 0;
      for (const vi of versionItems) {
        // 業者見積の unit_price が原価。cost_price が明示されていればそちらを優先
        const costPrice = vi.cost_price ?? vi.unit_price;
        const unitPrice = costPrice != null ? Math.round(costPrice * markupRate) : vi.unit_price;
        await apiFetch<QuoteItem>(`/api/v1/projects/${projectId}/quotes/${quoteId}/items`, {
          method: "POST",
          body: JSON.stringify({
            row_no: maxRow + offset + 1,
            section_id: targetSectionId || null,
            item_name: vi.item_name,
            spec: vi.spec,
            unit: vi.unit,
            quantity: vi.quantity,
            unit_price: unitPrice,
            cost_price: costPrice,
          }),
        });
        offset++;
      }
      setImportOpen(false);
      await load();
      showMsg(`${offset}件を取り込みました`);
    } catch (e) { showMsg(`取り込みエラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  // ── 値引き更新 ───────────────────────────────────────────────────────────
  const handleSaveDiscount = async () => {
    const val = parseFloat(discountInput.replace(/,/g, "")) || 0;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}`, {
        method: "PATCH",
        body: JSON.stringify({ discount_amount: val }),
      });
      setQuote(prev => prev ? { ...prev, discount_amount: val } : prev);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); setEditingDiscount(false); }
  };

  // ── 関連帳票生成 ──────────────────────────────────────────────────────────
  const handleGenerateDocs = async () => {
    setGeneratingDocs(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/generate-related-documents`, { method: "POST" });
      showMsg("注文書・注文請書・請求書のドラフトを生成しました");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setGeneratingDocs(false); }
  };

  // ── 集計 ─────────────────────────────────────────────────────────────────
  // version_id が設定されているアイテムは業者見積のものなので顧客見積では除外する
  const customerItems = (quote?.items ?? []).filter(i => !i.version_id);
  const subtotal = customerItems.reduce((s, i) => s + (i.amount ?? 0), 0);
  const discount = (quote?.discount_amount ?? 0);
  const taxBase = subtotal - discount;
  const tax = Math.floor(taxBase * 0.1);
  const total = taxBase + tax;
  // 粗利計算（原価 = QCDSのtotal_cost。QCDSなければ未設定）
  const qcdsCost = qcds !== null && qcds !== "none" ? qcds.calc.total_cost : null;
  const grossProfit = qcdsCost != null ? total - qcdsCost : null;
  const grossMarginRate = grossProfit != null && total > 0 ? (grossProfit / total) * 100 : null;
  const grossProfitMsg = qcds === "none" ? "QCDSを作成してください" : qcds === null ? null : total === 0 ? "顧客見積を作成してください" : null;

  const sectionItems = (sectionId: string) =>
    customerItems.filter(i => i.section_id === sectionId).sort((a, b) => a.row_no - b.row_no);

  const unsectionedItems = customerItems.filter(i => !i.section_id).sort((a, b) => a.row_no - b.row_no);

  if (loading || !quote) {
    return (
      <AppShell breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "顧客見積", href: `/projects/${projectId}/quote` },
        { label: "読み込み中" },
      ]}>
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--c-text-muted)" }}>読み込み中…</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "顧客見積", href: `/projects/${projectId}/quote` },
        { label: quote.quote_number || "見積書" },
      ]}
      action={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)", maxWidth: 260 }}>
              {msg}
            </span>
          )}
          {/* 選択削除バー（何か選択されている時だけ表示） */}
          {selectedCount > 0 && (
            <>
              <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                {selectedCount}件選択中
              </span>
              <Button size="sm" variant="default" onClick={() => { setSelectedItemIds(new Set()); setSelectedSectionIds(new Set()); }}>
                <X className="w-3 h-3" /> 解除
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{ background: "var(--c-danger)", color: "#fff", border: "none" }}
              >
                <Trash2 className="w-3 h-3" />
                {bulkDeleting ? "削除中…" : `削除 (${selectedCount})`}
              </Button>
            </>
          )}
          {/* 業者見積から取り込み */}
          {quote.versions.filter(v => quote.items.some(i => i.version_id === v.id)).length > 0 && (
            <Button size="sm" variant="default" onClick={() => setImportOpen(true)}>
              <ArrowDownToLine className="w-3.5 h-3.5" /> 業者見積から取り込み
            </Button>
          )}
          {/* テンプレ適用 */}
          {templates.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                style={{
                  fontSize: 12, padding: "3px 8px",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface)", color: "var(--c-text)", cursor: "pointer",
                }}
              >
                <option value="">テンプレを選択</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
              </select>
              <Button variant="default" size="sm" onClick={handleApplyTemplate} disabled={!selectedTemplate || saving}>
                適用
              </Button>
            </div>
          )}
          {/* Excel */}
          <Button
            variant="default" size="sm"
            onClick={() => {
              fetch(`${API_URL}/api/v1/projects/${projectId}/quotes/${quoteId}/export`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              }).then(r => r.blob()).then(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `見積書_${quote.quote_number || quoteId}.xlsx`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              });
            }}
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          {/* PDF */}
          <Button
            variant="default" size="sm"
            style={{ background: pdfLoading ? "#888" : "#C00000", color: "#fff" }}
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                const r = await fetch(`${API_URL}/api/v1/projects/${projectId}/quotes/${quoteId}/export-pdf`, {
                  headers: { Authorization: `Bearer ${getToken()}` },
                });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const blob = await r.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `見積書_${quote.quote_number || quoteId}.pdf`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              } catch (e) {
                showMsg(`PDF生成エラー: ${(e as Error).message}`);
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            <Download className="w-3.5 h-3.5" />
            {pdfLoading ? "生成中..." : "PDF"}
          </Button>
          <Button
            variant="default" size="sm"
            onClick={handleGenerateDocs}
            disabled={generatingDocs}
            style={{ background: "var(--c-primary)", color: "#fff" }}
          >
            {generatingDocs ? "生成中…" : "関連帳票を一括生成"}
          </Button>
        </div>
      }
    >
      {/* ── 2カラム本体 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 264px", gap: 12, alignItems: "start" }}>

        {/* ── 左カラム: 大項目ブロック ── */}
        <div>
          {quote.sections.length === 0 && (
            <div style={{
              padding: "20px 16px", marginBottom: 8, borderRadius: "var(--r-md)",
              background: "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))",
              border: "1px dashed var(--c-primary)", fontSize: 13, color: "var(--c-text-muted)",
              textAlign: "center",
            }}>
              大項目がありません。右パネルのフォームで追加するか、テンプレを適用してください。
            </div>
          )}

          {quote.sections.map(section => {
            const secItemIds = sectionItems(section.id).map(i => i.id);
            const allItemsSelected = secItemIds.length > 0 && secItemIds.every(id => selectedItemIds.has(id));
            return (
              <SectionBlock
                key={section.id}
                section={section}
                items={sectionItems(section.id)}
                onDeleteSection={() => handleDeleteSection(section.id)}
                onUpdateSection={(l, n) => handleUpdateSection(section.id, l, n)}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                saving={saving}
                sectionSelected={allItemsSelected}
                selectedItemIds={selectedItemIds}
                onToggleSection={() => {
                  const adding = !allItemsSelected;
                  setSelectedItemIds(prev => {
                    const n = new Set(prev);
                    secItemIds.forEach(id => adding ? n.add(id) : n.delete(id));
                    return n;
                  });
                }}
                onToggleItem={id => setSelectedItemIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              />
            );
          })}

          {/* 大項目未割り当て明細 */}
          {unsectionedItems.length > 0 && (
            <div className="card" style={{ overflow: "hidden", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)" }}>
                <input
                  type="checkbox"
                  checked={unsectionedItems.length > 0 && unsectionedItems.every(i => selectedItemIds.has(i.id))}
                  onChange={() => {
                    const allSel = unsectionedItems.every(i => selectedItemIds.has(i.id));
                    setSelectedItemIds(prev => {
                      const n = new Set(prev);
                      unsectionedItems.forEach(i => allSel ? n.delete(i.id) : n.add(i.id));
                      return n;
                    });
                  }}
                  style={{ cursor: "pointer" }}
                  title="未割り当て全件を選択"
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)" }}>大項目未割り当て</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--c-surface-2)" }}>
                      {["No", "工事項目", "仕様", "単位", "数量", "単価", "金額", "備考", ""].map((h, i) => (
                        <th key={i} style={{ padding: "4px 6px", fontSize: 10, fontWeight: 600, color: "var(--c-text-muted)", textAlign: i >= 4 && i <= 6 ? "right" : "left", borderBottom: "2px solid var(--c-border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unsectionedItems.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onUpdate={handleUpdateItem}
                        onDelete={() => handleDeleteItem(item.id)}
                        saving={saving}
                        selected={selectedItemIds.has(item.id)}
                        onToggleSelect={() => setSelectedItemIds(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "6px 12px", borderTop: "1px solid var(--c-border)" }}>
                <button
                  onClick={() => handleAddItem("")}
                  disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--c-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <Plus size={12} /> 行を追加
                </button>
              </div>
            </div>
          )}

          {/* 大項目追加フォーム */}
          <div className="card" style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>大項目を追加</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={addSectionLetter}
                onChange={e => setAddSectionLetter(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="A"
                style={{
                  width: 40, fontSize: 13, padding: "4px 8px", fontWeight: 700,
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface)", textAlign: "center",
                }}
              />
              <input
                value={addSectionName}
                onChange={e => setAddSectionName(e.target.value)}
                placeholder="大項目名（例：外壁工事）"
                style={{
                  flex: 1, fontSize: 13, padding: "4px 10px",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface)",
                }}
              />
              <Button
                size="sm" variant="default"
                onClick={handleAddSection}
                disabled={!addSectionLetter || !addSectionName || saving}
              >
                <Plus size={13} /> 追加
              </Button>
            </div>
          </div>
        </div>

        {/* ── 右カラム: スティッキー集計パネル ── */}
        <div style={{ position: "sticky", top: 12 }}>

          {/* 合計カード */}
          <div className="card" style={{ overflow: "hidden", marginBottom: 8 }}>
            {/* 青ヘッダ */}
            <div style={{
              background: "var(--c-primary)", color: "#fff",
              padding: "10px 14px",
            }}>
              <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>見積番号</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
                {quote.quote_number || "（未採番）"}
              </div>
            </div>

            {/* 金額行 */}
            <div style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>小計</span>
                <span style={{ fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmt(subtotal)}</span>
              </div>
              {/* 値引き（常時表示・クリックで編集） */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--c-danger)" }}>値引</span>
                {editingDiscount ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--c-danger)" }}>−¥</span>
                    <input
                      autoFocus
                      type="number"
                      value={discountInput}
                      onChange={e => setDiscountInput(e.target.value)}
                      onBlur={handleSaveDiscount}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveDiscount(); if (e.key === "Escape") setEditingDiscount(false); }}
                      style={{ width: 90, fontSize: 12, fontFamily: "var(--ff-mono)", textAlign: "right", padding: "1px 4px", border: "1px solid var(--c-danger)", borderRadius: "var(--r-md)", background: "var(--c-surface)" }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setDiscountInput(String(discount)); setEditingDiscount(true); }}
                    style={{ fontSize: 13, fontFamily: "var(--ff-mono)", color: discount > 0 ? "var(--c-danger)" : "var(--c-text-muted)", background: "none", border: "1px dashed transparent", borderRadius: "var(--r-md)", padding: "1px 4px", cursor: "pointer" }}
                    title="クリックして値引額を編集"
                  >
                    {discount > 0 ? `−${fmt(discount)}` : "＋ 値引を追加"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>消費税（10%）</span>
                <span style={{ fontSize: 13, fontFamily: "var(--ff-mono)" }}>{fmt(tax)}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                borderTop: "2px solid var(--c-primary)", paddingTop: 8,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>合計（税込）</span>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--ff-mono)", color: "var(--c-primary)" }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* 粗利ゲージ */}
          <div className="card" style={{ padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>粗利率</span>
              {grossMarginRate !== null ? (
                <span style={{
                  fontSize: 14, fontWeight: 700, fontFamily: "var(--ff-mono)",
                  color: grossMarginRate >= 25 ? "var(--c-success)" : grossMarginRate >= 15 ? "var(--c-warning, #f59e0b)" : "var(--c-danger)",
                }}>
                  {grossMarginRate.toFixed(1)}%
                </span>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>---</span>
              )}
            </div>
            {grossMarginRate !== null ? (
              <>
                <div style={{ height: 6, borderRadius: 3, background: "var(--c-surface-2)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${Math.min(100, Math.max(0, grossMarginRate))}%`,
                    background: grossMarginRate >= 25 ? "var(--c-success)" : grossMarginRate >= 15 ? "#f59e0b" : "var(--c-danger)",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>原価（QCDS） {fmt(qcdsCost)}</span>
                  <span style={{ fontSize: 10, color: "var(--c-text-muted)" }}>粗利 {fmt(grossProfit)}</span>
                </div>
              </>
            ) : grossProfitMsg ? (
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>{grossProfitMsg}</div>
            ) : null}
          </div>

          {/* 大項目別内訳 */}
          {quote.sections.length > 0 && (
            <div className="card" style={{ padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>大項目別内訳</div>
              {quote.sections.map(section => {
                const secTotal = sectionItems(section.id).reduce((s, i) => s + (i.amount ?? 0), 0);
                const pct = subtotal > 0 ? (secTotal / subtotal) * 100 : 0;
                return (
                  <div key={section.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 11 }}>
                        <span style={{ fontWeight: 700, color: "var(--c-primary)", marginRight: 4 }}>{section.section_letter}</span>
                        {section.section_name}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: "var(--ff-mono)" }}>{fmt(secTotal)}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: "var(--c-surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: "var(--c-primary)", opacity: 0.5 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 承認スタンプ欄 */}
          <div className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>稟議承認</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {([
                {
                  label: "担当",
                  stampType: "person_in_charge" as const,
                  userId: quote.person_in_charge_id,
                  at: quote.person_in_charge_confirmed_at,
                  canStamp: ["staff", "manager", "admin", "super_admin", "member"].includes(user?.role ?? ""),
                  requiredRole: "スタッフ以上",
                },
                {
                  label: "確認",
                  stampType: "reviewer" as const,
                  userId: quote.reviewer_id,
                  at: quote.reviewed_at,
                  canStamp: ["manager", "admin", "super_admin"].includes(user?.role ?? ""),
                  requiredRole: "上長・管理者",
                },
                {
                  label: "承認",
                  stampType: "approver" as const,
                  userId: quote.approver_id,
                  at: quote.approved_at,
                  canStamp: ["admin", "super_admin"].includes(user?.role ?? ""),
                  requiredRole: "管理者",
                },
              ]).map(({ label, stampType, userId, at, canStamp, requiredRole }) => {
                const stampedUser = stampUsers.find(u => u.id === userId);
                const isStamped = !!at;
                const isActive = stampTarget === stampType;
                return (
                  <div key={stampType} style={{ position: "relative", textAlign: "center" }}>
                    {/* スタンプ枠 */}
                    <div style={{
                      border: `1.5px solid ${isStamped ? "#C00000" : isActive ? "var(--c-primary)" : "var(--c-border)"}`,
                      borderRadius: "var(--r-md)", padding: "6px 4px",
                      opacity: canStamp ? 1 : 0.65,
                    }}>
                      <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 4 }}>{label}</div>
                      <div
                        onClick={() => {
                          if (!canStamp) {
                            showMsg(`「${label}」押印には${requiredRole}の権限が必要です`);
                            return;
                          }
                          if (isStamped) {
                            if (confirm(`「${label}」の押印を取り消しますか？`)) {
                              handleStamp(stampType, userId!, false);
                            }
                          } else {
                            setStampTarget(isActive ? null : stampType);
                          }
                        }}
                        style={{
                          width: 38, height: 38, borderRadius: "50%",
                          border: `2px solid ${isStamped ? "#C00000" : canStamp ? "var(--c-border)" : "var(--c-border)"}`,
                          borderStyle: canStamp ? "solid" : "dashed",
                          margin: "0 auto",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: "pointer",
                          background: isStamped ? "color-mix(in oklab, #C00000 8%, white)" : "transparent",
                        }}
                        title={canStamp ? (isStamped ? "クリックで取り消し" : "クリックして押印") : `${requiredRole}の権限が必要です`}
                      >
                        {isStamped && stampedUser ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#C00000", lineHeight: 1 }}>
                            {stampedUser.full_name.slice(-1)}
                          </span>
                        ) : canStamp ? (
                          <span style={{ fontSize: 9, color: "var(--c-text-muted)" }}>押印</span>
                        ) : (
                          <span style={{ fontSize: 8, color: "var(--c-text-muted)", lineHeight: 1.2, textAlign: "center" }}>
                            {requiredRole}
                          </span>
                        )}
                      </div>
                      {isStamped && stampedUser && (
                        <div style={{ fontSize: 8, color: "#C00000", marginTop: 3, fontWeight: 600 }}>
                          {stampedUser.full_name}
                        </div>
                      )}
                      {at && (
                        <div style={{ fontSize: 8, color: "var(--c-text-muted)", marginTop: 1 }}>
                          {new Date(at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </div>
                      )}
                    </div>
                    {/* ユーザー選択ドロップダウン */}
                    {isActive && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setStampTarget(null)} />
                        <div style={{
                          position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
                          minWidth: 140,
                          zIndex: 100, background: "var(--c-surface)",
                          border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                          boxShadow: "0 8px 24px rgba(0,0,0,.15)", maxHeight: 200, overflowY: "auto",
                        }}>
                          <div style={{ padding: "6px 10px", fontSize: 10, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>
                            押印者を選択
                          </div>
                          {stampUsers.length === 0 ? (
                            <div style={{ padding: "10px", fontSize: 11, color: "var(--c-text-muted)", textAlign: "center" }}>
                              ユーザー読込中...
                            </div>
                          ) : stampUsers.map(u => (
                            <div
                              key={u.id}
                              onMouseDown={() => handleStamp(stampType, u.id, true)}
                              style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              {u.full_name}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {stampLoading && (
              <div style={{ fontSize: 10, color: "var(--c-text-muted)", textAlign: "center", marginTop: 6 }}>押印中...</div>
            )}
          </div>
        </div>
      </div>

      {/* 業者見積から取り込みモーダル */}
      {importOpen && (() => {
        const vendorVersions = quote.versions.filter(v => quote.items.some(i => i.version_id === v.id));
        return (
          <ImportFromEstimateModal
            versions={vendorVersions}
            sections={quote.sections}
            onClose={() => setImportOpen(false)}
            onImport={handleImportFromEstimate}
            saving={saving}
          />
        );
      })()}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 業者見積から取り込みモーダル
// ---------------------------------------------------------------------------

function ImportFromEstimateModal({
  versions,
  sections,
  onClose,
  onImport,
  saving,
}: {
  versions: QuoteVersion[];
  sections: QuoteSection[];
  onClose: () => void;
  onImport: (versionId: string, sectionId: string | null) => Promise<void>;
  saving: boolean;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState(versions[0]?.id ?? "");
  const [targetSectionId, setTargetSectionId] = useState<string>("");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--c-surface)", borderRadius: "var(--r-lg)",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        width: 440, padding: "20px 24px",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <ArrowDownToLine size={16} style={{ color: "var(--c-primary)" }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>業者見積から取り込み</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>取り込む業者版</div>
            {versions.map(v => (
              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", borderRadius: "var(--r-md)", background: selectedVersionId === v.id ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))" : "transparent" }}>
                <input type="radio" name="version" value={v.id} checked={selectedVersionId === v.id} onChange={() => setSelectedVersionId(v.id)} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{v.vendor_name_snapshot || `版 ${v.version_no}`}</span>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)", marginLeft: "auto" }}>掛率 ×{Number(v.markup_rate).toFixed(2)}</span>
              </label>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>追加先の大項目（任意）</div>
            <select
              value={targetSectionId}
              onChange={e => setTargetSectionId(e.target.value)}
              style={{ width: "100%", fontSize: 12, padding: "6px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)" }}
            >
              <option value="">大項目未割り当て</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.section_letter} {s.section_name}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 11, color: "var(--c-text-muted)", background: "var(--c-surface-2)", padding: "8px 10px", borderRadius: "var(--r-md)" }}>
            ※ 業者見積の原価単価に掛率を乗じた値を単価として取り込みます
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: "6px 16px", fontSize: 13, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>
            キャンセル
          </button>
          <button
            onClick={() => onImport(selectedVersionId, targetSectionId || null)}
            disabled={!selectedVersionId || saving}
            style={{ padding: "6px 20px", fontSize: 13, fontWeight: 600, background: "var(--c-primary)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer" }}
          >
            {saving ? "取り込み中…" : "取り込む"}
          </button>
        </div>
      </div>
    </div>
  );
}
