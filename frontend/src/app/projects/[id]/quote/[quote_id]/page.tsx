"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Download, ArrowDownToLine, X, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen } from "@/lib/format";
import {
  SectionBlock,
  ItemRow,
  type QuoteSection,
  type QuoteItem,
} from "@/modules/estimate/SectionBlock";
import {
  ApprovalStamps,
  type UserOption,
} from "@/modules/estimate/ApprovalStamps";
import { QuoteTotals } from "@/modules/estimate/QuoteTotals";

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

interface ProjectHeader {
  project_name: string | null;
  client_name: string | null;
  project_location: string | null;
  period_contract_start: string | null;
  period_contract_end: string | null;
  payment_condition: string | null;
  sales_person_name: string | null;
  sales_person_id: string | null;
}

interface SectionTemplate {
  id: string;
  template_name: string;
  items: { section_code: string; section_name: string; display_order: number }[];
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
  const [project, setProject] = useState<ProjectHeader | null>(null);
  const [qcds, setQcds] = useState<QCDSSummary | null | "none">(null);
  const [templates, setTemplates] = useState<SectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 見積書ヘッダー編集
  const [editingHeader, setEditingHeader] = useState(false);
  const [hdrIssueDate, setHdrIssueDate] = useState("");
  const [hdrValidityDays, setHdrValidityDays] = useState("30");
  const [hdrLocation, setHdrLocation] = useState("");
  const [hdrPeriodStart, setHdrPeriodStart] = useState("");
  const [hdrPeriodEnd, setHdrPeriodEnd] = useState("");
  const [hdrPayment, setHdrPayment] = useState("");
  const [hdrRemarks, setHdrRemarks] = useState("");

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

  // 見積条件書
  const [conditionItems, setConditionItems] = useState<{ id: string; display_order: number; content: string }[]>([]);
  const [conditionTemplates, setConditionTemplates] = useState<{ id: string; section_name: string | null; content: string }[]>([]);
  const [addingCondition, setAddingCondition] = useState(false);
  const [newConditionText, setNewConditionText] = useState("");
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [editingConditionText, setEditingConditionText] = useState("");
  const [showTmplModal, setShowTmplModal] = useState(false);
  // テンプレ編集モーダル用
  const [tmplEditText, setTmplEditText] = useState("");
  const [condPdfLoading, setCondPdfLoading] = useState(false);

  // 承認依頼モーダル
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  // 承認ワークフロー
  const [approvalRequests, setApprovalRequests] = useState<{
    id: string;
    status: string;
    requester_id: string;
    request_comment: string | null;
    created_at: string;
    steps: {
      id: string; step_no: number; approver_id: string; approver_name: string;
      role_label: string; required: boolean; status: string; comment: string | null; decided_at: string | null;
    }[];
  }[]>([]);

  // 値引き編集
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  // 承認スタンプ
  const [stampUsers, setStampUsers] = useState<UserOption[]>([]);

  // ── データ取得 ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, tmplList, proj, condItems, condTmpls] = await Promise.all([
        apiFetch<QuoteDetail>(`/api/v1/projects/${projectId}/quotes/${quoteId}`),
        apiFetch<SectionTemplate[]>("/api/v1/section-templates"),
        apiFetch<ProjectHeader>(`/api/v1/projects/${projectId}`),
        apiFetch<{ id: string; display_order: number; content: string }[]>(`/api/v1/projects/${projectId}/quotes/${quoteId}/condition-items`),
        // admin/quote-conditions: { id, name, content, is_active } の形式
        apiFetch<{ id: string; name: string; content: string; is_active: boolean }[]>("/api/v1/admin/quote-conditions")
          .then(ts => ts.filter(t => t.is_active).map(t => ({ id: t.id, section_name: t.name, content: t.content })))
          .catch(() => []),
      ]);
      setQuote(detail);
      setTemplates(tmplList);
      setProject(proj);
      // ヘッダー state を最新値で初期化
      setHdrIssueDate(detail.issue_date || "");
      setHdrValidityDays(String(detail.validity_days ?? 30));
      setHdrLocation(detail.project_location_snapshot || proj.project_location || "");
      setHdrPeriodStart(detail.period_start || proj.period_contract_start || "");
      setHdrPeriodEnd(detail.period_end || proj.period_contract_end || "");
      setHdrPayment(detail.payment_condition || proj.payment_condition || "");
      setHdrRemarks(detail.remarks || "");
      setConditionItems(condItems);
      setConditionTemplates(condTmpls);

      // 承認依頼を非同期で取得（失敗しても続行）
      apiFetch<typeof approvalRequests>(`/api/v1/projects/${projectId}/quotes/${quoteId}/approval-requests`)
        .then(setApprovalRequests)
        .catch(() => {});
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

  const handleSaveHeader = async () => {
    setSaving(true);
    try {
      await Promise.all([
        // 見積書側フィールド更新
        apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}`, {
          method: "PATCH",
          body: JSON.stringify({
            issue_date: hdrIssueDate || null,
            validity_days: parseInt(hdrValidityDays) || 30,
            project_location_snapshot: hdrLocation || null,
            period_start: hdrPeriodStart || null,
            period_end: hdrPeriodEnd || null,
            payment_condition: hdrPayment || null,
            remarks: hdrRemarks || null,
          }),
        }),
        // 案件側フィールドも同期
        apiFetch(`/api/v1/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({
            project_location: hdrLocation || null,
            period_contract_start: hdrPeriodStart || null,
            period_contract_end: hdrPeriodEnd || null,
            payment_condition: hdrPayment || null,
          }),
        }),
      ]);
      setEditingHeader(false);
      await load();
      showMsg("ヘッダーを保存しました");
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  // ── 見積条件書操作 ──────────────────────────────────────────────────────────
  const handleAddConditionItem = async (content: string) => {
    if (!content.trim()) return;
    try {
      const item = await apiFetch<{ id: string; display_order: number; content: string }>(
        `/api/v1/projects/${projectId}/quotes/${quoteId}/condition-items`,
        { method: "POST", body: JSON.stringify({ content }) }
      );
      setConditionItems(prev => [...prev, item]);
      setNewConditionText("");
      setAddingCondition(false);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  };

  const handleUpdateConditionItem = async (id: string, content: string) => {
    try {
      const updated = await apiFetch<{ id: string; display_order: number; content: string }>(
        `/api/v1/projects/${projectId}/quotes/${quoteId}/condition-items/${id}`,
        { method: "PATCH", body: JSON.stringify({ content }) }
      );
      setConditionItems(prev => prev.map(i => i.id === id ? updated : i));
      setEditingConditionId(null);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  };

  const handleDeleteConditionItem = async (id: string) => {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/condition-items/${id}`, { method: "DELETE" });
      setConditionItems(prev => prev.filter(i => i.id !== id));
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  };

  const handleMoveConditionItem = async (idx: number, dir: -1 | 1) => {
    const newItems = [...conditionItems];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    setConditionItems(newItems);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/condition-items/reorder`,
        { method: "POST", body: JSON.stringify({ item_ids: newItems.map(i => i.id) }) }
      );
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
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

  const handleReorderSections = async (sectionIds: string[]) => {
    setSaving(true);
    try {
      const updated = await apiFetch<QuoteSection[]>(
        `/api/v1/projects/${projectId}/quotes/${quoteId}/sections/reorder`,
        { method: "POST", body: JSON.stringify({ section_ids: sectionIds }) }
      );
      setQuote(prev => prev ? { ...prev, sections: updated } : prev);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };

  const moveSectionUp = (idx: number) => {
    if (!quote || idx === 0) return;
    const ids = quote.sections.map(s => s.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    handleReorderSections(ids);
  };

  const moveSectionDown = (idx: number) => {
    if (!quote || idx === quote.sections.length - 1) return;
    const ids = quote.sections.map(s => s.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    handleReorderSections(ids);
  };

  // D&D state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
      {/* ── 承認ステータスバー ── */}
      {(() => {
        const pending = approvalRequests.find(r => r.status === "pending");
        if (!pending) return null;
        const doneCount = pending.steps.filter(s => s.status === "approved").length;
        const total = pending.steps.length;
        const pendingStep = pending.steps.find(s => s.status === "pending");
        return (
          <div style={{
            background: "color-mix(in oklab, var(--c-warn) 8%, var(--c-surface))",
            border: "1px solid color-mix(in oklab, var(--c-warn) 35%, var(--c-border))",
            borderRadius: "var(--r-lg)", padding: "14px 18px",
            display: "grid", gridTemplateColumns: "auto 1fr auto",
            gap: 18, alignItems: "center", marginBottom: 12,
          }}>
            {/* パルスアイコン */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--c-warn)", color: "#fff",
              display: "grid", placeItems: "center", flexShrink: 0,
              boxShadow: "0 0 0 4px color-mix(in oklab, var(--c-warn) 25%, transparent)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
            </div>
            {/* 説明 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>
                承認待ち（{doneCount} / {total} 完了）
              </div>
              <div style={{ fontSize: 12, color: "var(--c-text-muted)", marginTop: 2 }}>
                {pendingStep ? `残り承認者: ${pendingStep.approver_name}（${pendingStep.role_label}）` : "全ステップ完了待ち"}
              </div>
            </div>
            {/* ステップ + 取り下げボタン */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {pending.steps.map((s, i) => {
                  const isDone = s.status === "approved";
                  const isCur = s.status === "pending";
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-subtle)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      )}
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 10px", background: "var(--c-surface)",
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", fontSize: 12,
                      }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: isDone ? "var(--c-success)" : isCur ? "var(--c-warn)" : "var(--c-surface-2)",
                          border: `1.5px solid ${isDone ? "var(--c-success)" : isCur ? "var(--c-warn)" : "var(--c-border-strong)"}`,
                          display: "grid", placeItems: "center", flexShrink: 0,
                          color: isDone || isCur ? "#fff" : "var(--c-text-subtle)", fontSize: 10, fontWeight: 700,
                        }}>
                          {isDone ? "✓" : isCur ? "●" : s.step_no}
                        </span>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--c-text-muted)", fontWeight: 600 }}>{s.role_label}</div>
                          <div style={{ fontWeight: 600 }}>{s.approver_name.split(/[\s　]/)[0]}</div>
                        </div>
                        {s.decided_at && (
                          <span style={{ fontSize: 10, color: "var(--c-text-subtle)", fontFamily: "var(--ff-mono)" }}>
                            {new Date(s.decided_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ width: 1, height: 32, background: "var(--c-border)", margin: "0 4px" }} />
              <button
                onClick={async () => {
                  if (!confirm("承認依頼を取り下げますか？")) return;
                  try {
                    await apiFetch(`/api/v1/approval-requests/${pending.id}/withdraw`, { method: "POST" });
                    setApprovalRequests(prev => prev.map(r => r.id === pending.id ? { ...r, status: "withdrawn" } : r));
                  } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--c-text-muted)", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                依頼を取り下げる
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── ロック通知（承認待ち中） ── */}
      {approvalRequests.some(r => r.status === "pending") && (
        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          padding: "9px 14px",
          background: "var(--c-info-bg)",
          borderRadius: "var(--r-md)", fontSize: 12,
          borderLeft: "3px solid var(--c-info)", marginBottom: 12,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-info)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span>
            承認待ち中のため編集はロックされています。編集する場合は <strong>「依頼を取り下げる」</strong> を押してください。
            <strong style={{ color: "var(--c-warn)" }}>編集すると全承認が自動リセット</strong>され、再依頼が必要になります。
          </span>
        </div>
      )}

      {/* ── Quote Hero ── */}
      {quote && (
        <div style={{
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: "var(--r-lg)", padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 14, marginBottom: 12,
        }}>
          <span style={{
            fontFamily: "var(--ff-mono)", fontSize: 13, color: "var(--c-text-muted)",
            background: "var(--c-surface-2)", padding: "3px 9px",
            borderRadius: "var(--r-md)", fontWeight: 600, flexShrink: 0,
          }}>
            {quote.quote_number || "—"}
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>御見積書</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-text-muted)" }}>
              {project?.project_name || quote.project_name_snapshot || ""}
              {project?.client_name ? ` · ${project.client_name} 御中` : ""}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setApprovalModalOpen(true)}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 600,
                border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                cursor: "pointer", background: "var(--c-surface)",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              承認依頼
            </button>
          </div>
        </div>
      )}

      {/* ── 2カラム本体 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: 12, alignItems: "start" }}>

        {/* ── 左カラム: 大項目ブロック ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* ── 見積書ヘッダー ── */}
          <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>見積書ヘッダー</div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>PDF/Excel 出力時に反映されます</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {editingHeader ? (
              <>
                <Button variant="default" size="sm" onClick={() => { setEditingHeader(false); }} style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>キャンセル</Button>
                <Button variant="primary" size="sm" onClick={handleSaveHeader} disabled={saving}>保存</Button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={() => setEditingHeader(true)} style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>編集</Button>
            )}
          </div>
        </div>
        {editingHeader ? (
          /* 編集モード */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>工事場所</label>
              <Input value={hdrLocation} onChange={e => setHdrLocation(e.target.value)} placeholder="福井県坂井市..." />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>工期 開始</label>
              <Input type="date" value={hdrPeriodStart} onChange={e => setHdrPeriodStart(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>工期 終了</label>
              <Input type="date" value={hdrPeriodEnd} onChange={e => setHdrPeriodEnd(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>支払条件</label>
              <Input value={hdrPayment} onChange={e => setHdrPayment(e.target.value)} placeholder="月末締・翌月末払" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>見積日</label>
              <Input type="date" value={hdrIssueDate} onChange={e => setHdrIssueDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>有効期限（日）</label>
              <Input type="number" value={hdrValidityDays} onChange={e => setHdrValidityDays(e.target.value)} min={1} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 3 }}>備考</label>
              <textarea value={hdrRemarks} onChange={e => setHdrRemarks(e.target.value)} rows={2}
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "6px 10px", fontSize: 13, resize: "vertical" }}
              />
            </div>
          </div>
        ) : (
          /* 表示モード — qf-grid（ボーダー付きテーブル）*/
          (() => {
            const K: React.CSSProperties = {
              background: "var(--c-surface-2)", color: "var(--c-text-muted)",
              fontSize: 12, fontWeight: 500,
              padding: "9px 12px", borderBottom: "1px solid var(--c-border)",
              borderRight: "1px solid var(--c-border)",
              display: "flex", alignItems: "center", minHeight: 36,
            };
            const V: React.CSSProperties = {
              fontSize: 13, padding: "9px 12px",
              borderBottom: "1px solid var(--c-border)",
              borderRight: "1px solid var(--c-border)",
              display: "flex", alignItems: "center", minHeight: 36,
            };
            const Vr: React.CSSProperties = { ...V, borderRight: "none" }; // 右端
            const period = hdrPeriodStart && hdrPeriodEnd
              ? `${hdrPeriodStart}〜${hdrPeriodEnd}`
              : hdrPeriodStart || hdrPeriodEnd || "—";
            return (
              <div style={{
                display: "grid", gridTemplateColumns: "100px 1fr 100px 1fr",
                borderTop: "1px solid var(--c-border)",
              }}>
                {/* 宛先 */}
                <div style={K}>宛先</div>
                <div style={{ ...Vr, gridColumn: "2 / span 3", fontWeight: 600 }}>
                  {project?.client_name ? `${project.client_name}　御中` : "—"}
                </div>
                {/* 件名 */}
                <div style={K}>件名</div>
                <div style={{ ...Vr, gridColumn: "2 / span 3" }}>
                  {project?.project_name || quote.project_name_snapshot || "—"}
                </div>
                {/* 工事場所 | 工期 */}
                <div style={K}>工事場所</div>
                <div style={V}>{hdrLocation || "—"}</div>
                <div style={K}>工期</div>
                <div style={Vr}>{period}</div>
                {/* 支払条件 | 有効期限 */}
                <div style={K}>支払条件</div>
                <div style={V}>{hdrPayment || "—"}</div>
                <div style={K}>有効期限</div>
                <div style={Vr}>発行日より {hdrValidityDays} 日</div>
                {/* 見積日 | 担当者 */}
                <div style={K}>見積日</div>
                <div style={V}>{hdrIssueDate || "—"}</div>
                <div style={K}>担当者</div>
                <div style={{ ...Vr, gap: 6 }}>
                  {project?.sales_person_name ? (
                    <>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--c-primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {(project.sales_person_name.split(/[\s　]/)[0] || "").slice(0, 1)}
                      </span>
                      {project.sales_person_name}
                    </>
                  ) : "—"}
                </div>
                {/* 備考 */}
                <div style={{ ...K, borderBottom: "none" }}>備考</div>
                <div style={{ ...Vr, gridColumn: "2 / span 3", borderBottom: "none", whiteSpace: "pre-wrap", alignItems: "flex-start", paddingTop: 10, paddingBottom: 10, lineHeight: 1.6 }}>
                  {hdrRemarks || "—"}
                </div>
              </div>
            );
          })()
        )}
      </div>

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

          {quote.sections.map((section, idx) => {
            const secItemIds = sectionItems(section.id).map(i => i.id);
            const allItemsSelected = secItemIds.length > 0 && secItemIds.every(id => selectedItemIds.has(id));
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx;
            return (
              <div
                key={section.id}
                draggable
                onDragStart={() => { setDragIdx(idx); }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragEnd={() => {
                  if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
                    const ids = quote.sections.map(s => s.id);
                    const [moved] = ids.splice(dragIdx, 1);
                    ids.splice(dragOverIdx, 0, moved);
                    handleReorderSections(ids);
                  }
                  setDragIdx(null); setDragOverIdx(null);
                }}
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  outline: isDragOver && !isDragging ? "2px solid var(--c-primary)" : "none",
                  outlineOffset: 2,
                  borderRadius: "var(--r-md)",
                  marginBottom: 2,
                }}
              >
                {/* 上下矢印 */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 2, marginBottom: 2 }}>
                  <button
                    title="上へ移動"
                    disabled={idx === 0 || saving}
                    onClick={() => moveSectionUp(idx)}
                    style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "var(--c-text-subtle)" : "var(--c-text-muted)", padding: "1px 4px", borderRadius: "var(--r-sm)" }}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="下へ移動"
                    disabled={idx === quote.sections.length - 1 || saving}
                    onClick={() => moveSectionDown(idx)}
                    style={{ background: "none", border: "none", cursor: idx === quote.sections.length - 1 ? "not-allowed" : "pointer", color: idx === quote.sections.length - 1 ? "var(--c-text-subtle)" : "var(--c-text-muted)", padding: "1px 4px", borderRadius: "var(--r-sm)" }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <SectionBlock
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
              </div>
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

          {/* ── 見積条件書 ── */}
          <div className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>見積条件書</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Button variant="default" size="sm" style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}
                  onClick={() => {
                    // テンプレートがあれば最初のものを表示、なければ空
                    const first = conditionTemplates[0];
                    setTmplEditText(first?.content ?? "");
                    setShowTmplModal(true);
                  }}>
                  テンプレ呼び出し
                </Button>
                <Button variant="default" size="sm" style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}
                  onClick={() => { setAddingCondition(true); setNewConditionText(""); }}>＋ 追加</Button>
                <Button variant="default" size="sm"
                  disabled={conditionItems.length === 0 || condPdfLoading}
                  style={{ background: "var(--c-danger)", color: "#fff", opacity: conditionItems.length === 0 ? 0.4 : 1 }}
                  onClick={async () => {
                    setCondPdfLoading(true);
                    try {
                      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/quotes/${quoteId}/condition-pdf`, {
                        headers: { Authorization: `Bearer ${getToken()}` },
                      });
                      const blob = await res.blob();
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `見積条件書.pdf`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    } catch { alert("PDF出力に失敗しました"); }
                    finally { setCondPdfLoading(false); }
                  }}>
                  {condPdfLoading ? "生成中..." : "PDF出力"}
                </Button>
              </div>
            </div>
            {conditionItems.length === 0 && !addingCondition && (
              <p style={{ fontSize: 12, color: "var(--c-text-muted)", textAlign: "center", padding: "12px 0" }}>
                条件書の項目がありません。「＋ 追加」またはテンプレートから挿入してください。
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {conditionItems.map((item, idx) => (
                <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: "var(--r-md)", background: editingConditionId === item.id ? "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))" : "var(--c-surface-2)" }}>
                  {editingConditionId === item.id ? (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <textarea
                        value={editingConditionText}
                        onChange={e => setEditingConditionText(e.target.value)}
                        rows={Math.max(12, editingConditionText.split("\n").length + 3)}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          fontSize: 12, lineHeight: 1.7, padding: "8px 10px",
                          border: "2px solid var(--c-primary)", borderRadius: "var(--r-sm)",
                          resize: "vertical", fontFamily: "inherit",
                          background: "var(--c-surface)", color: "var(--c-text)",
                        }}
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditingConditionId(null)}
                          style={{ fontSize: 12, padding: "4px 14px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)", cursor: "pointer" }}>キャンセル</button>
                        <button onClick={() => handleUpdateConditionItem(item.id, editingConditionText)}
                          style={{ fontSize: 12, padding: "4px 14px", background: "var(--c-primary)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", cursor: "pointer", fontWeight: 600 }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ flex: 1, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", paddingTop: 3 }}>{item.content}</span>
                  )}
                  {editingConditionId !== item.id && (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button onClick={() => handleMoveConditionItem(idx, -1)} disabled={idx === 0}
                        style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: "var(--c-text-muted)", padding: "2px 4px" }}>↑</button>
                      <button onClick={() => handleMoveConditionItem(idx, 1)} disabled={idx === conditionItems.length - 1}
                        style={{ background: "none", border: "none", cursor: idx === conditionItems.length - 1 ? "not-allowed" : "pointer", color: "var(--c-text-muted)", padding: "2px 4px" }}>↓</button>
                      <button onClick={() => { setEditingConditionId(item.id); setEditingConditionText(item.content); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 11, padding: "2px 6px" }}>編集</button>
                      <button onClick={() => { if (confirm("この項目を削除しますか？")) handleDeleteConditionItem(item.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", fontSize: 11, padding: "2px 6px" }}>削除</button>
                    </div>
                  )}
                </div>
              ))}
              {addingCondition && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: "var(--r-md)", background: "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea value={newConditionText} onChange={e => setNewConditionText(e.target.value)}
                      rows={Math.max(8, newConditionText.split("\n").length + 3)} autoFocus
                      placeholder="条件書の内容を入力..."
                      style={{ width: "100%", boxSizing: "border-box", fontSize: 12, lineHeight: 1.7, padding: "8px 10px", border: "2px solid var(--c-primary)", borderRadius: "var(--r-sm)", resize: "vertical", fontFamily: "inherit", background: "var(--c-surface)", color: "var(--c-text)" }}
                    />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleAddConditionItem(newConditionText)}
                        style={{ fontSize: 11, padding: "2px 10px", background: "var(--c-primary)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", cursor: "pointer" }}>追加</button>
                      <button onClick={() => setAddingCondition(false)}
                        style={{ fontSize: 11, padding: "2px 10px", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)", cursor: "pointer" }}>キャンセル</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>{/* 左カラム end */}

        {/* ── 右カラム ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
          <QuoteTotals
            quoteNumber={quote.quote_number}
            sections={quote.sections}
            subtotal={subtotal}
            discount={discount}
            tax={tax}
            total={total}
            grossMarginRate={grossMarginRate}
            grossProfit={grossProfit}
            grossProfitMsg={grossProfitMsg}
            qcdsCost={qcdsCost}
            editingDiscount={editingDiscount}
            setEditingDiscount={setEditingDiscount}
            discountInput={discountInput}
            setDiscountInput={setDiscountInput}
            handleSaveDiscount={handleSaveDiscount}
            sectionItems={sectionItems}
          />
          <ApprovalStamps
            personInChargeId={project?.sales_person_id || null}
            reviewerId={quote.reviewer_id}
            reviewedAt={quote.reviewed_at}
            approverId={quote.approver_id}
            approvedAt={quote.approved_at}
            stampUsers={stampUsers}
            pendingApproverName={(() => {
              const pending = approvalRequests.find(r => r.status === "pending");
              if (!pending) return null;
              const step = pending.steps.find(s => s.status === "pending");
              return step?.approver_name ?? null;
            })()}
          />
          <button
            onClick={() => setApprovalModalOpen(true)}
            style={{
              width: "100%", marginTop: 8, padding: "8px 0",
              background: "var(--c-primary)", color: "#fff", border: "none",
              borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
            承認依頼を送信
          </button>

          {/* 承認コメント・履歴 */}
          {(() => {
            // 全承認依頼からコメントを収集（新しい順）
            const comments: { name: string; role: string; body: string; at: string }[] = [];
            for (const req of approvalRequests) {
              // 依頼コメント
              if (req.request_comment) {
                const requester = stampUsers.find(u => u.id === req.requester_id);
                comments.push({
                  name: requester?.full_name || "依頼者",
                  role: "承認依頼",
                  body: req.request_comment,
                  at: req.created_at,
                });
              }
              // ステップコメント（承認/差戻し）
              for (const step of req.steps) {
                if (step.comment && step.decided_at) {
                  comments.push({
                    name: step.approver_name,
                    role: `${step.role_label}・${step.status === "approved" ? "承認" : "差戻し"}`,
                    body: step.comment,
                    at: step.decided_at,
                  });
                }
              }
            }
            // 新しい順にソート
            comments.sort((a, b) => b.at.localeCompare(a.at));
            if (comments.length === 0) return null;
            return (
              <div style={{
                padding: 14, background: "var(--c-surface)",
                border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", marginTop: 12,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)",
                  letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10,
                }}>
                  承認コメント · 履歴
                </div>
                {comments.map((c, i) => {
                  const initial = (c.name.split(/[\s　]/)[0] || "").slice(0, 1);
                  const colors = ["var(--c-status-progress)", "var(--c-primary)", "var(--c-success)", "var(--c-status-billed)"];
                  const bg = colors[i % colors.length];
                  return (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "28px 1fr", gap: 10,
                      padding: "8px 0",
                      borderBottom: i < comments.length - 1 ? "1px dashed var(--c-border)" : "none",
                      fontSize: 12,
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", background: bg, color: "#fff",
                        display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
                      }}>{initial}</div>
                      <div>
                        <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{c.name}</span>
                          <span style={{
                            fontSize: 10, padding: "1px 5px", borderRadius: "var(--r-pill)",
                            background: "var(--c-surface-2)", color: "var(--c-text-muted)",
                          }}>{c.role}</span>
                          <span style={{ color: "var(--c-text-subtle)", fontSize: 10, fontFamily: "var(--ff-mono)", marginLeft: "auto" }}>
                            {new Date(c.at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} {new Date(c.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ color: "var(--c-text)", lineHeight: 1.5 }}>{c.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>{/* 右カラム end */}
      </div>{/* 2カラムグリッド end */}

      {/* テンプレート呼び出し・編集モーダル */}
      {showTmplModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowTmplModal(false)}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 700, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <span>見積条件書 テンプレート呼び出し</span>
              {conditionTemplates.length > 1 && (
                <select onChange={e => { const t = conditionTemplates.find(t => t.id === e.target.value); if (t) setTmplEditText(t.content); }}
                  style={{ fontSize: 12, padding: "3px 8px", border: "1px solid var(--c-border)", borderRadius: "var(--r-sm)", background: "var(--c-surface)" }}>
                  {conditionTemplates.map(t => <option key={t.id} value={t.id}>{t.section_name}</option>)}
                </select>
              )}
            </div>
            <div style={{ padding: "10px 16px", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-muted)" }}>
              工事件名・工期・支払い条件は案件から自動取得されます。内容を確認・編集してから「この内容で適用」を押してください。
            </div>
            <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--c-border)", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12 }}>
              <span style={{ color: "var(--c-text-muted)", fontWeight: 600 }}>工事件名:</span>
              <span>{quote?.project_name_snapshot || project?.project_name || "—"}</span>
              <span style={{ color: "var(--c-text-muted)", fontWeight: 600 }}>工　　期:</span>
              <span>{hdrPeriodStart && hdrPeriodEnd ? `${hdrPeriodStart} ～ ${hdrPeriodEnd}` : hdrPeriodStart || hdrPeriodEnd || "（未設定）"}</span>
              <span style={{ color: "var(--c-text-muted)", fontWeight: 600 }}>支払条件:</span>
              <span>{hdrPayment || "御協議の上"}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              <textarea value={tmplEditText} onChange={e => setTmplEditText(e.target.value)} rows={20}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, lineHeight: 1.7, padding: "8px 12px",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", resize: "vertical",
                  background: "var(--c-surface)", color: "var(--c-text)", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--c-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowTmplModal(false)}
                style={{ padding: "6px 16px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", cursor: "pointer", fontSize: 13 }}>キャンセル</button>
              <button onClick={() => { handleAddConditionItem(tmplEditText); setShowTmplModal(false); }}
                style={{ padding: "6px 18px", border: "none", borderRadius: "var(--r-md)", background: "var(--c-primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                この内容で適用
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 承認依頼モーダル */}
      {approvalModalOpen && (
        <ApprovalModal
          quoteId={quoteId}
          projectId={projectId}
          quoteNumber={quote.quote_number}
          stampUsers={stampUsers}
          currentUserId={user?.id ?? ""}
          personInChargeId={quote.person_in_charge_id}
          reviewerId={quote.reviewer_id}
          approverId={quote.approver_id}
          personInChargeConfirmedAt={quote.person_in_charge_confirmed_at}
          reviewedAt={quote.reviewed_at}
          approvedAt={quote.approved_at}
          onClose={() => setApprovalModalOpen(false)}
          onSent={() => { setApprovalModalOpen(false); showMsg("承認依頼を送信しました"); load(); }}
        />
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// 承認依頼モーダル
// ---------------------------------------------------------------------------

function ApprovalModal({
  quoteId, projectId, quoteNumber, stampUsers, currentUserId,
  personInChargeId, reviewerId, approverId,
  personInChargeConfirmedAt, reviewedAt, approvedAt,
  onClose, onSent,
}: {
  quoteId: string; projectId: string; quoteNumber: string | null;
  stampUsers: UserOption[]; currentUserId: string;
  personInChargeId: string | null; reviewerId: string | null; approverId: string | null;
  personInChargeConfirmedAt: string | null; reviewedAt: string | null; approvedAt: string | null;
  onClose: () => void; onSent: () => void;
}) {
  const [step1, setStep1] = useState(personInChargeId || currentUserId);
  const [step2, setStep2] = useState(reviewerId || "");
  const [step3, setStep3] = useState(approverId || "");
  const [skip2, setSkip2] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  // 既にスタンプ済み（前回承認済み）かどうか
  const step1AlreadyApproved = !!(personInChargeId && personInChargeId === step1 && personInChargeConfirmedAt);
  const step2AlreadyApproved = !!(reviewerId && reviewerId === step2 && reviewedAt);
  const step3AlreadyApproved = !!(approverId && approverId === step3 && approvedAt);

  const handleSend = async () => {
    if (!step1) { alert("担当者を選択してください"); return; }
    if (!step3) { alert("承認者を選択してください"); return; }
    setSending(true);
    try {
      const steps = [
        { approver_id: step1, role_label: "担当", required: true },
        ...(!skip2 && step2 ? [{ approver_id: step2, role_label: "確認", required: false }] : []),
        { approver_id: step3, role_label: "承認", required: true },
      ];
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quoteId}/approval-requests`, {
        method: "POST",
        body: JSON.stringify({ steps, request_comment: comment || null }),
      });
      onSent();
    } catch (e) { alert(`エラー: ${(e as Error).message}`); }
    finally { setSending(false); }
  };

  const sel = (label: string, val: string, setVal: (v: string) => void, alreadyApproved: boolean) => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
      <select value={val} onChange={e => setVal(e.target.value)}
        style={{ flex: 1, fontSize: 12, padding: "5px 8px", border: `1px solid ${alreadyApproved ? "var(--c-success)" : "var(--c-border)"}`, borderRadius: "var(--r-md)", background: alreadyApproved ? "color-mix(in oklab,var(--c-success) 8%,var(--c-surface))" : "var(--c-surface)" }}>
        <option value="">選択してください</option>
        {stampUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
      </select>
      {alreadyApproved && (
        <span style={{ fontSize: 10, color: "var(--c-success)", fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 2 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
          承認済
        </span>
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 560, overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "color-mix(in oklab,var(--c-primary) 12%,var(--c-surface))", borderRadius: "var(--r-md)", display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="1.6"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>承認依頼を作成</div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{quoteNumber || "見積書"} · 順次承認</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* ステップ一覧 */}
          {[
            { no: 1, label: "担当", val: step1, set: setStep1, required: true, alreadyApproved: step1AlreadyApproved },
            { no: 2, label: "確認", val: step2, set: setStep2, required: false, skip: skip2, setSkip: setSkip2, alreadyApproved: step2AlreadyApproved },
            { no: 3, label: "承認", val: step3, set: setStep3, required: true, alreadyApproved: step3AlreadyApproved },
          ].map(s => (
            <div key={s.no} style={{ display: "grid", gridTemplateColumns: "28px 52px 1fr auto", gap: 10, alignItems: "center", padding: "10px 12px", border: `1px solid ${s.alreadyApproved ? "color-mix(in oklab,var(--c-success) 30%,var(--c-border))" : "var(--c-border)"}`, borderRadius: "var(--r-md)", opacity: s.skip ? 0.5 : 1 }}>
              <div style={{ width: 22, height: 22, background: s.alreadyApproved ? "var(--c-success)" : "var(--c-primary)", color: "#fff", borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>
                {s.alreadyApproved ? "✓" : s.no}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, background: "var(--c-surface-2)", borderRadius: "var(--r-pill)", padding: "3px 8px", textAlign: "center" }}>{s.label}</div>
              {s.skip ? <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>スキップ</span> : sel(s.label, s.val, s.set, s.alreadyApproved ?? false)}
              {!s.required && (
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--c-text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={s.skip} onChange={e => s.setSkip?.(e.target.checked)} />スキップ
                </label>
              )}
              {s.required && <div />}
            </div>
          ))}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "var(--c-text-muted)" }}>依頼コメント（任意）</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="例：見積金額を確定したいです。ご確認ください。"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", resize: "vertical" }} />
          </div>

          <div style={{ padding: "8px 12px", background: "color-mix(in oklab,var(--c-info) 10%,var(--c-surface))", borderRadius: "var(--r-md)", fontSize: 12, borderLeft: "3px solid var(--c-primary)" }}>
            📱 アプリ内通知が各承認者に送信されます
          </div>
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-surface-2)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 16px", fontSize: 12, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>キャンセル</button>
          <button onClick={handleSend} disabled={sending}
            style={{ padding: "6px 20px", fontSize: 12, fontWeight: 700, background: "var(--c-primary)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer" }}>
            {sending ? "送信中..." : "承認依頼を送信"}
          </button>
        </div>
      </div>
    </div>
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
