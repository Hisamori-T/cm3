"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { fmtYen } from "@/lib/format";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface QuoteVersion {
  id: string;
  version_no: number;
  vendor_id: string | null;
  vendor_name_snapshot: string | null;
  markup_rate: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface QuoteItem {
  id: string;
  row_no: number;
  item_name: string | null;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  cost_price: number | null;
  item_markup_rate: number | null;
  unit_price: number | null;
  amount: number | null;
  remarks: string | null;
  version_id: string | null;
  section_id: string | null;
}

interface QuoteDetail {
  id: string;
  project_id: string;
  versions: QuoteVersion[];
  sections: { id: string; section_letter: string; section_name: string; row_no: number; amount: number | null }[];
  items: QuoteItem[];
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
}

interface EditItem extends QuoteItem {
  _edited?: boolean;
}

interface PriceHistoryItem {
  id: string;
  item_name: string | null;
  item_spec: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const fmt = fmtYen;

const calcAmount = (quantity: number | null, unit_price: number | null) =>
  quantity != null && unit_price != null ? Math.round(quantity * unit_price) : null;

const calcUnitPrice = (cost_price: number | null, markup: number) =>
  cost_price != null ? Math.round(cost_price * markup) : null;

// ---------------------------------------------------------------------------
// ページ本体
// ---------------------------------------------------------------------------

/** 業者見積管理ページ。案件に紐づく見積版と明細を管理する。 */
export default function EstimatePage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 版追加モード: null=非表示 / "choose"=選択 / "master"=マスタ追加 / "manual"=手動作成
  const [addMode, setAddMode] = useState<"choose" | "master" | "manual" | null>(null);
  // 手動作成フォーム
  const [manualVendorName, setManualVendorName] = useState("");
  const [manualMarkup, setManualMarkup] = useState("1.0");
  // 業者マスタから追加
  const [masterSearch, setMasterSearch] = useState("");
  const [masterOptions, setMasterOptions] = useState<{ id: string; vendor_name: string }[]>([]);
  const [masterSelected, setMasterSelected] = useState<{ id: string; vendor_name: string } | null>(null);
  const [masterHistory, setMasterHistory] = useState<PriceHistoryItem[]>([]);
  const [masterMarkup, setMasterMarkup] = useState("1.0");
  const [masterLoading, setMasterLoading] = useState(false);
  const masterSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 版ごとに独立した掛率入力値（selectedVersion が変わるたびにリセット）
  const [markupInput, setMarkupInput] = useState<string>("1.0");

  // スキャン統合（複数ファイル対応）
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanJobs, setScanJobs] = useState<{
    jobId: string;
    fileName: string;
    status: "uploading" | "analyzing" | "saving" | "done" | "error";
    message: string;
  }[]>([]);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // QCDSに反映ダイアログ
  const [qcdsReflectVer, setQcdsReflectVer] = useState<QuoteVersion | null>(null);
  const [qcdsCategory, setQcdsCategory] = useState<"subcontract" | "material" | "other">("subcontract");
  const [qcdsReflecting, setQcdsReflecting] = useState(false);

  // 顧客見積に反映ダイアログ
  const [quoteReflectVer, setQuoteReflectVer] = useState<QuoteVersion | null>(null);
  const [reflectMarkup, setReflectMarkup] = useState("1.0");
  const [reflectSectionType, setReflectSectionType] = useState<"new" | "existing">("new");
  const [reflectSectionName, setReflectSectionName] = useState("");
  const [reflectSectionId, setReflectSectionId] = useState<string>("");
  const [quoteReflecting, setQuoteReflecting] = useState(false);
  const [customerQuoteId, setCustomerQuoteId] = useState<string | null>(null);
  const [customerSections, setCustomerSections] = useState<{ id: string; section_letter: string; section_name: string }[]>([]);


  // ---------------------------------------------------------------------------
  // データ取得
  // ---------------------------------------------------------------------------

  const loadQuote = useCallback(async () => {
    try {
      let list = await apiFetch<{ id: string }[]>(`/api/v1/projects/${projectId}/quotes`);
      if (!list.length) {
        await apiFetch(`/api/v1/projects/${projectId}/quotes`, { method: "POST", body: JSON.stringify({}) });
        list = await apiFetch<{ id: string }[]>(`/api/v1/projects/${projectId}/quotes`);
      }
      if (!list.length) { setError("見積書の作成に失敗しました"); return; }
      const detail = await apiFetch<QuoteDetail>(`/api/v1/projects/${projectId}/quotes/${list[0].id}`);
      setQuote(detail);
      setCustomerQuoteId(list[0].id);
      setCustomerSections(detail.sections);
      if (!selectedVersionId && detail.versions.length > 0) {
        setSelectedVersionId(detail.versions[0].id);
      }
    } catch {
      setError("データの取得に失敗しました");
    }
  }, [projectId, selectedVersionId]);

  useEffect(() => { loadQuote(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 複数スキャンジョブのポーリング
  useEffect(() => {
    const activeJobs = scanJobs.filter(j => j.status === "analyzing");
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      let reloadNeeded = false;
      for (const job of activeJobs) {
        try {
          const data = await apiFetch<{ id: string; status: string; error_message: string | null; results: { id: string }[] }>(
            `/api/v1/scan/jobs/${job.jobId}`
          );
          if (data.status === "succeeded") {
            setScanJobs(prev => prev.map(j => j.jobId === job.jobId
              ? { ...j, status: "saving", message: "版を作成中…" } : j));
            const resultId = data.results[0]?.id;
            if (resultId) {
              try {
                await apiFetch(`/api/v1/scan/results/${resultId}/save-as-version`, {
                  method: "POST",
                  body: JSON.stringify({ project_id: projectId }),
                });
                setScanJobs(prev => prev.map(j => j.jobId === job.jobId
                  ? { ...j, status: "done", message: "版が追加されました" } : j));
                reloadNeeded = true;
              } catch (e) {
                setScanJobs(prev => prev.map(j => j.jobId === job.jobId
                  ? { ...j, status: "error", message: `版作成失敗: ${(e as Error).message}` } : j));
              }
            }
          } else if (data.status === "failed") {
            setScanJobs(prev => prev.map(j => j.jobId === job.jobId
              ? { ...j, status: "error", message: data.error_message || "スキャン失敗" } : j));
          }
        } catch { /* ignore transient polling errors */ }
      }
      if (reloadNeeded) await loadQuote();
    }, 2500);
    return () => clearInterval(interval);
  }, [scanJobs, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 完了・失敗ジョブを5秒後に自動消去
  useEffect(() => {
    const finishedJobs = scanJobs.filter(j => j.status === "done" || j.status === "error");
    if (finishedJobs.length === 0) return;
    const timer = setTimeout(() => {
      setScanJobs(prev => prev.filter(j => j.status !== "done" && j.status !== "error"));
    }, 5000);
    return () => clearTimeout(timer);
  }, [scanJobs]);

  // D&Dは左パネルの常設ゾーンで処理（グローバルリスナー不要）

  // 選択版が変わったら editItems と markupInput を更新（掛率変更時に単価を再計算）
  useEffect(() => {
    if (!quote || !selectedVersionId) { setEditItems([]); return; }
    const version = quote.versions.find(v => v.id === selectedVersionId);
    if (version) setMarkupInput(String(version.markup_rate));
    const globalMarkup = version?.markup_rate ?? 1.0;
    const versionItems = quote.items
      .filter(i => i.version_id === selectedVersionId)
      .sort((a, b) => a.row_no - b.row_no);
    setEditItems(versionItems.map(i => {
      const effectiveMarkup = i.item_markup_rate ?? globalMarkup;
      const unit_price = i.cost_price != null ? Math.round(i.cost_price * effectiveMarkup) : i.unit_price;
      const amount = i.quantity != null && unit_price != null ? Math.round(i.quantity * unit_price) : i.amount;
      return { ...i, unit_price, amount };
    }));
  }, [quote, selectedVersionId]);

  // ---------------------------------------------------------------------------
  // 版操作
  // ---------------------------------------------------------------------------

  // 業者マスタ検索
  const handleMasterSearch = (q: string) => {
    setMasterSearch(q);
    setMasterSelected(null);
    setMasterHistory([]);
    if (masterSearchTimer.current) clearTimeout(masterSearchTimer.current);
    masterSearchTimer.current = setTimeout(async () => {
      if (!q) { setMasterOptions([]); return; }
      try {
        const d = await apiFetch<{ items: { id: string; vendor_name: string }[] }>(
          `/api/v1/vendors?q=${encodeURIComponent(q)}&per_page=20`
        );
        setMasterOptions(d.items);
      } catch { setMasterOptions([]); }
    }, 300);
  };

  // 業者マスタから選択して過去単価履歴を読込
  const handleMasterSelect = async (vendor: { id: string; vendor_name: string }) => {
    setMasterSelected(vendor);
    setMasterSearch(vendor.vendor_name);
    setMasterOptions([]);
    setMasterLoading(true);
    try {
      const d = await apiFetch<{ items: PriceHistoryItem[] }>(
        `/api/v1/vendors/${vendor.id}/price-history?per_page=200`
      );
      setMasterHistory(d.items || []);
    } catch { setMasterHistory([]); }
    finally { setMasterLoading(false); }
  };

  // 業者マスタから版を作成（過去単価履歴を明細に反映）
  const handleCreateFromMaster = async () => {
    if (!quote || !masterSelected) return;
    setSaving(true);
    try {
      const markup = parseFloat(masterMarkup) || 1.0;
      const version = await apiFetch<QuoteVersion>(
        `/api/v1/projects/${projectId}/quotes/${quote.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({
            vendor_id: masterSelected.id,
            vendor_name_snapshot: masterSelected.vendor_name,
            markup_rate: markup,
          }),
        }
      );
      // 過去単価履歴から明細を作成
      if (masterHistory.length > 0) {
        const existingItems = quote.items.map((i, idx) => ({
          row_no: idx + 1, item_name: i.item_name, spec: i.spec, unit: i.unit,
          quantity: i.quantity, cost_price: i.cost_price, item_markup_rate: i.item_markup_rate,
          unit_price: i.unit_price, remarks: i.remarks, version_id: i.version_id, section_id: i.section_id,
        }));
        const base = existingItems.length;
        const newItems = masterHistory.map((ph, i) => ({
          row_no: base + i + 1,
          item_name: ph.item_name,
          spec: ph.item_spec,
          unit: ph.unit,
          quantity: ph.quantity,
          cost_price: ph.unit_price,
          item_markup_rate: null,
          unit_price: ph.unit_price != null ? Math.round(ph.unit_price * markup) : null,
          remarks: null,
          version_id: version.id,
          section_id: null,
        }));
        await apiFetch(`/api/v1/projects/${projectId}/quotes/${quote.id}`, {
          method: "PATCH",
          body: JSON.stringify({ items: [...existingItems, ...newItems] }),
        });
      }
      setSelectedVersionId(version.id);
      setAddMode(null);
      setMasterSelected(null);
      setMasterSearch("");
      setMasterHistory([]);
      await loadQuote();
    } catch {
      setError("版の作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 手動で版を作成（業者マスタに登録されていない業者）
  const handleCreateManual = async () => {
    if (!quote || !manualVendorName.trim()) return;
    setSaving(true);
    try {
      const v = await apiFetch<QuoteVersion>(`/api/v1/projects/${projectId}/quotes/${quote.id}/versions`, {
        method: "POST",
        body: JSON.stringify({
          vendor_id: null,
          vendor_name_snapshot: manualVendorName.trim(),
          markup_rate: parseFloat(manualMarkup) || 1.0,
        }),
      });
      setManualVendorName("");
      setManualMarkup("1.0");
      setAddMode(null);
      setSelectedVersionId(v.id);
      await loadQuote();
    } catch {
      setError("版の追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (versionId: string, current: boolean) => {
    if (!quote) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quote.id}/versions/${versionId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !current }),
      });
      await loadQuote();
    } catch {
      setError("更新に失敗しました");
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!quote || !confirm("この版を削除しますか？明細も削除されます。")) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quote.id}/versions/${versionId}`, {
        method: "DELETE",
      });
      if (selectedVersionId === versionId) {
        const remaining = quote.versions.filter(v => v.id !== versionId);
        setSelectedVersionId(remaining[0]?.id ?? null);
      }
      await loadQuote();
    } catch {
      setError("削除に失敗しました");
    }
  };

  const handleMarkupChange = async (versionId: string, newRate: string) => {
    if (!quote) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 1) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quote.id}/versions/${versionId}`, {
        method: "PATCH",
        body: JSON.stringify({ markup_rate: rate }),
      });
      await loadQuote();
    } catch {
      setError("更新に失敗しました");
    }
  };

  // ---------------------------------------------------------------------------
  // スキャン・反映ハンドラー
  // ---------------------------------------------------------------------------

  const handleScanFiles = async (files: File[]) => {
    const accepted = files.filter(f =>
      /\.(pdf|jpg|jpeg|png|xlsx|xls)$/i.test(f.name)
    );
    if (accepted.length === 0) return;

    for (const file of accepted) {
      const placeholderId = `uploading-${Date.now()}-${file.name}`;
      setScanJobs(prev => [...prev, {
        jobId: placeholderId,
        fileName: file.name,
        status: "uploading",
        message: "アップロード中…",
      }]);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const job = await apiFetch<{ id: string }>(`/api/v1/scan/upload?project_id=${projectId}`, {
          method: "POST",
          body: fd,
        });
        setScanJobs(prev => prev.map(j => j.jobId === placeholderId
          ? { ...j, jobId: job.id, status: "analyzing", message: "AI解析中…" } : j));
      } catch (e) {
        setScanJobs(prev => prev.map(j => j.jobId === placeholderId
          ? { ...j, status: "error", message: `アップロード失敗: ${(e as Error).message}` } : j));
      }
    }
  };


  const handleQcdsReflect = async () => {
    if (!qcdsReflectVer) return;
    setQcdsReflecting(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/qcds/reflect-from-version`, {
        method: "POST",
        body: JSON.stringify({ version_id: qcdsReflectVer.id, category: qcdsCategory }),
      });
      setQcdsReflectVer(null);
      setScanMsg(`「${qcdsReflectVer.vendor_name_snapshot || ""}」をQCDSに反映しました`);
      setTimeout(() => setScanMsg(null), 3000);
    } catch (e) {
      setScanMsg(`QCDS反映失敗: ${(e as Error).message}`);
    } finally {
      setQcdsReflecting(false);
    }
  };

  const handleQuoteReflect = async () => {
    if (!quoteReflectVer || !customerQuoteId) return;
    setQuoteReflecting(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/quotes/${customerQuoteId}/reflect-from-version`, {
        method: "POST",
        body: JSON.stringify({
          version_id: quoteReflectVer.id,
          markup_rate: parseFloat(reflectMarkup) || 1.0,
          section_type: reflectSectionType,
          section_name: reflectSectionType === "new" ? reflectSectionName : undefined,
          section_id: reflectSectionType === "existing" ? reflectSectionId : undefined,
        }),
      });
      setQuoteReflectVer(null);
      setScanMsg(`「${quoteReflectVer.vendor_name_snapshot || ""}」を顧客見積に反映しました`);
      await loadQuote();
      setTimeout(() => setScanMsg(null), 3000);
    } catch (e) {
      setScanMsg(`顧客見積反映失敗: ${(e as Error).message}`);
    } finally {
      setQuoteReflecting(false);
    }
  };


  // ---------------------------------------------------------------------------
  // 明細行操作
  // ---------------------------------------------------------------------------

  const selectedVersion = quote?.versions.find(v => v.id === selectedVersionId) ?? null;

  const updateItem = (idx: number, field: keyof EditItem, value: string) => {
    setEditItems(prev => {
      const next = [...prev];
      const item = { ...next[idx], _edited: true } as EditItem;
      const numVal = value === "" ? null : parseFloat(value);

      if (field === "cost_price") {
        item.cost_price = numVal;
        const markup = item.item_markup_rate ?? selectedVersion?.markup_rate ?? 1.0;
        const newUp = calcUnitPrice(numVal, markup);
        item.unit_price = newUp;
        item.amount = calcAmount(item.quantity, newUp);
      } else if (field === "quantity") {
        item.quantity = numVal;
        const markup = item.item_markup_rate ?? selectedVersion?.markup_rate ?? 1.0;
        const newUp = calcUnitPrice(item.cost_price, markup);
        item.unit_price = newUp;
        item.amount = calcAmount(numVal, newUp);
      } else if (field === "item_markup_rate") {
        item.item_markup_rate = numVal;
        const markup = numVal ?? selectedVersion?.markup_rate ?? 1.0;
        const newUp = calcUnitPrice(item.cost_price, markup);
        item.unit_price = newUp;
        item.amount = calcAmount(item.quantity, newUp);
      } else if (field === "unit_price") {
        item.unit_price = numVal;
        item.amount = calcAmount(item.quantity, numVal);
      } else if (field === "item_name" || field === "spec" || field === "unit" || field === "remarks") {
        item[field] = value === "" ? null : value;
      }

      next[idx] = item;
      return next;
    });
  };

  const addRow = () => {
    if (!selectedVersionId) return;
    const maxRow = editItems.reduce((m, i) => Math.max(m, i.row_no), 0);
    setEditItems(prev => [...prev, {
      id: `_new_${Date.now()}`,
      row_no: maxRow + 1,
      item_name: null, spec: null, unit: null, quantity: null,
      cost_price: null, item_markup_rate: null, unit_price: null,
      amount: null, remarks: null,
      version_id: selectedVersionId, section_id: null,
      _edited: true,
    }]);
  };

  const removeRow = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const saveItems = async () => {
    if (!quote || !selectedVersionId) return;
    setSaving(true);
    setError(null);
    try {
      // 全アイテム（他版含む）を構築して PATCH
      const otherItems = quote.items.filter(i => i.version_id !== selectedVersionId);
      const allItems = [
        ...otherItems.map((i, idx) => ({
          row_no: idx + 1,
          item_name: i.item_name, spec: i.spec, unit: i.unit,
          quantity: i.quantity, cost_price: i.cost_price,
          item_markup_rate: i.item_markup_rate, unit_price: i.unit_price,
          remarks: i.remarks, version_id: i.version_id, section_id: i.section_id,
        })),
        ...editItems.map((i, idx) => ({
          row_no: otherItems.length + idx + 1,
          item_name: i.item_name, spec: i.spec, unit: i.unit,
          quantity: i.quantity, cost_price: i.cost_price,
          item_markup_rate: i.item_markup_rate, unit_price: i.unit_price,
          remarks: i.remarks, version_id: selectedVersionId, section_id: i.section_id,
        })),
      ];

      await apiFetch(`/api/v1/projects/${projectId}/quotes/${quote.id}`, {
        method: "PATCH",
        body: JSON.stringify({ items: allItems }),
      });
      await loadQuote();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 合計計算（現在の editItems から）
  // ---------------------------------------------------------------------------

  const versionSubtotal = editItems.reduce((s, i) => s + (i.amount ?? 0), 0);
  const versionTax = Math.floor(versionSubtotal * 0.1);
  const versionTotal = versionSubtotal + versionTax;

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  if (!quote) {
    return (
      <AppShell breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "業者見積管理" },
      ]}>
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--c-text-muted)" }}>
          読み込み中...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "業者見積管理" },
      ]}
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/projects/${projectId}/quote`}>
            <Button variant="default" size="sm">顧客向け見積 →</Button>
          </Link>
          <Button variant="primary" onClick={saveItems} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      }
    >
      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 13,
          background: "var(--c-danger-bg)", color: "var(--c-danger)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, transparent)",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "start" }}>

        {/* 左ペイン：版リスト */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* ヘッダー */}
          <div style={{ padding: "12px", borderBottom: "1px solid var(--c-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)" }}>業者見積版</span>
              <button
                onClick={() => setAddMode(v => v ? null : "choose")}
                style={{
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  background: addMode ? "var(--c-surface-2)" : "var(--c-primary)",
                  color: addMode ? "var(--c-text)" : "#fff",
                  border: addMode ? "1px solid var(--c-border)" : "none",
                  borderRadius: "var(--r-md)", cursor: "pointer", fontSize: 18, lineHeight: 1, fontWeight: 600,
                }}
                title="版を追加"
              >{addMode ? "×" : "+"}</button>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", background: "var(--c-primary)", border: "none",
                cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 600,
                padding: "7px", borderRadius: "var(--r-md)",
              }}
            >+ スキャン（PDF/画像）</button>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" multiple style={{ display: "none" }}
              onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) { e.target.value = ""; handleScanFiles(files); } }} />
          </div>

          {/* 版追加モード: 選択パネル */}
          {addMode === "choose" && (
            <div style={{ padding: "8px", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)", display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                onClick={() => { setAddMode("master"); setMasterSearch(""); setMasterSelected(null); setMasterHistory([]); }}
                style={{
                  padding: "9px 12px", fontSize: 12, fontWeight: 600, textAlign: "left",
                  background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)", cursor: "pointer", color: "var(--c-primary)",
                }}
              >📋 業者マスタから追加（過去単価を自動取込）</button>
              <button
                onClick={() => { setAddMode("manual"); setManualVendorName(""); setManualMarkup("1.0"); }}
                style={{
                  padding: "9px 12px", fontSize: 12, fontWeight: 600, textAlign: "left",
                  background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)", cursor: "pointer", color: "var(--c-text)",
                }}
              >✏️ 手動で作成（マスタにない業者）</button>
            </div>
          )}

          {/* 業者マスタから追加フォーム */}
          {addMode === "master" && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                <button onClick={() => setAddMode("choose")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--c-text-muted)", padding: "0 2px" }}>←</button>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)" }}>業者マスタから追加</span>
              </div>
              {!masterSelected ? (
                /* 業者検索 */
                <div>
                  <input
                    autoFocus
                    value={masterSearch}
                    onChange={e => handleMasterSearch(e.target.value)}
                    placeholder="業者名で検索..."
                    style={{
                      width: "100%", fontSize: 12, padding: "6px 8px", marginBottom: 4,
                      border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  {masterOptions.length === 0 && masterSearch.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--c-text-muted)", padding: "4px 2px" }}>見つかりません</div>
                  )}
                  {masterOptions.map(v => (
                    <div key={v.id} onMouseDown={() => handleMasterSelect(v)}
                      style={{ padding: "7px 8px", fontSize: 12, cursor: "pointer", borderRadius: "var(--r-md)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >{v.vendor_name}</div>
                  ))}
                </div>
              ) : (
                /* 業者選択済み → 掛率設定 + 単価確認 → 版作成 */
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{masterSelected.vendor_name}</span>
                    <button onClick={() => { setMasterSelected(null); setMasterSearch(""); setMasterHistory([]); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--c-text-muted)" }}>変更</button>
                  </div>
                  {masterLoading ? (
                    <div style={{ fontSize: 11, color: "var(--c-text-muted)", padding: "6px 0" }}>単価履歴を読込中...</div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 6 }}>
                      過去単価 {masterHistory.length} 件
                      {masterHistory.length > 0 && `（${masterHistory.slice(0,2).map(h => h.item_name).join("、")}${masterHistory.length > 2 ? "…" : ""}）`}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>掛率</span>
                    <input
                      type="number" step="0.01" min="1"
                      value={masterMarkup}
                      onChange={e => setMasterMarkup(e.target.value)}
                      style={{
                        width: 70, fontSize: 13, fontWeight: 600, padding: "3px 6px",
                        border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                      }}
                    />
                  </div>
                  <button
                    onClick={handleCreateFromMaster}
                    disabled={saving || masterLoading}
                    style={{
                      width: "100%", padding: "7px", fontSize: 12, fontWeight: 600,
                      background: "var(--c-primary)", color: "#fff", border: "none",
                      borderRadius: "var(--r-md)", cursor: saving ? "wait" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >{saving ? "作成中..." : `版を作成${masterHistory.length > 0 ? `（${masterHistory.length}行）` : ""}`}</button>
                </div>
              )}
            </div>
          )}

          {/* 手動で版を作成フォーム */}
          {addMode === "manual" && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                <button onClick={() => setAddMode("choose")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--c-text-muted)", padding: "0 2px" }}>←</button>
                <span style={{ fontSize: 11, fontWeight: 600 }}>手動で作成</span>
              </div>
              <input
                autoFocus
                value={manualVendorName}
                onChange={e => setManualVendorName(e.target.value)}
                placeholder="業者名（自由入力）"
                style={{
                  width: "100%", fontSize: 12, padding: "6px 8px", marginBottom: 6,
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>掛率</span>
                <input
                  type="number" step="0.01" min="1"
                  value={manualMarkup}
                  onChange={e => setManualMarkup(e.target.value)}
                  style={{
                    width: 70, fontSize: 13, fontWeight: 600, padding: "3px 6px",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleCreateManual} disabled={saving || !manualVendorName.trim()}
                  style={{
                    flex: 1, padding: "7px", fontSize: 12, fontWeight: 600,
                    background: "var(--c-primary)", color: "#fff", border: "none",
                    borderRadius: "var(--r-md)", cursor: "pointer", opacity: !manualVendorName.trim() ? 0.5 : 1,
                  }}
                >空の版を作成</button>
                <button onClick={() => setAddMode("choose")}
                  style={{
                    padding: "7px 12px", fontSize: 12,
                    background: "var(--c-surface)", border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-md)", cursor: "pointer",
                  }}
                >戻る</button>
              </div>
            </div>
          )}

          {/* D&Dゾーン（ヘッダー直下） */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length) handleScanFiles(files);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              margin: "8px",
              padding: "12px 8px",
              border: `2px dashed ${isDragging ? "var(--c-primary)" : "var(--c-border)"}`,
              borderRadius: "var(--r-md)",
              textAlign: "center",
              cursor: "pointer",
              background: isDragging ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))" : "transparent",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={isDragging ? "var(--c-primary)" : "var(--c-text-muted)"}
              strokeWidth="1.5" style={{ display: "block", margin: "0 auto 4px" }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            <div style={{ fontSize: 11, fontWeight: 600, color: isDragging ? "var(--c-primary)" : "var(--c-text-muted)" }}>
              {isDragging ? "ドロップしてスキャン開始" : "PDF / 画像をドロップ"}
            </div>
            <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>またはクリックして選択</div>
          </div>
          {scanJobs.filter(j => j.status !== "done").length > 0 && (
            <div style={{ borderBottom: "1px solid var(--c-border)" }}>
              {scanJobs.filter(j => j.status !== "done").map(job => (
                <div key={job.jobId} style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
                  {job.status !== "error" ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2.5"
                      style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  )}
                  <span style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: job.status === "error" ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                    {job.fileName.length > 16 ? job.fileName.slice(0, 14) + "…" : job.fileName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {quote.versions.length === 0 && (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--c-text-muted)", fontSize: 12, borderBottom: "1px solid var(--c-border)" }}>
              版がありません
            </div>
          )}
          {quote.versions.map(v => (
            <div
              key={v.id}
              onClick={() => setSelectedVersionId(v.id)}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--c-border)",
                  cursor: "pointer",
                  background: selectedVersionId === v.id ? "var(--c-primary-50)" : "transparent",
                  borderLeft: selectedVersionId === v.id ? "3px solid var(--c-primary)" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: selectedVersionId === v.id ? "var(--c-primary)" : "var(--c-text)",
                  }}>
                    版 {v.version_no}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: "var(--r-pill)",
                    background: v.is_active ? "var(--c-success-bg)" : "var(--c-surface-2)",
                    color: v.is_active ? "var(--c-success)" : "var(--c-text-muted)",
                  }}>
                    {v.is_active ? "適用中" : "非適用"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--c-text)", marginBottom: 2 }}>
                  {v.vendor_name_snapshot || "（業者未設定）"}
                </div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                  掛率: ×{Number(v.markup_rate).toFixed(2)}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setQcdsReflectVer(v); setQcdsCategory("subcontract"); }}
                    style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-primary)" }}
                  >QCDSに反映</button>
                  <button
                    onClick={() => { setQuoteReflectVer(v); setReflectMarkup(String(v.markup_rate)); setReflectSectionType("new"); setReflectSectionName(""); setReflectSectionId(""); }}
                    style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-accent)" }}
                  >顧客見積に反映</button>
                  <button
                    onClick={() => handleToggleActive(v.id, v.is_active)}
                    style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-text-muted)" }}
                  >{v.is_active ? "非適用に" : "適用に"}</button>
                  <button
                    onClick={() => handleDeleteVersion(v.id)}
                    style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer", background: "var(--c-surface)", color: "var(--c-danger)" }}
                  >削除</button>
                </div>
              </div>
            )
          )}

        </div>

        {/* 右ペイン：明細テーブル */}
        <div>
          {/* スキャン進捗（常に右ペイン上部に表示） */}
          {scanJobs.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 8 }}>
              {scanJobs.map(job => (
                <div key={job.jobId} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                  borderBottom: "1px solid var(--c-border)",
                  background: job.status === "done" ? "color-mix(in oklab, var(--c-success) 6%, var(--c-surface))"
                    : job.status === "error" ? "color-mix(in oklab, var(--c-danger) 6%, var(--c-surface))"
                    : "var(--c-surface)",
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", display: "grid", placeItems: "center", flexShrink: 0,
                    background: job.status === "done" ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))"
                      : job.status === "error" ? "color-mix(in oklab, var(--c-danger) 12%, var(--c-surface))"
                      : "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
                  }}>
                    {(job.status === "uploading" || job.status === "analyzing" || job.status === "saving") ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2"
                        style={{ animation: "spin 1s linear infinite" }}>
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : job.status === "done" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: job.status === "done" ? "var(--c-success)" : job.status === "error" ? "var(--c-danger)" : "var(--c-text-muted)", marginTop: 2 }}>
                      {job.message}
                    </div>
                    {(job.status === "uploading" || job.status === "analyzing" || job.status === "saving") && (
                      <div style={{ height: 3, borderRadius: 2, background: "var(--c-surface-2)", marginTop: 6, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2, background: "var(--c-primary)",
                          width: job.status === "uploading" ? "20%" : job.status === "analyzing" ? "60%" : "90%",
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: "var(--r-pill)", flexShrink: 0, fontWeight: 600,
                    background: job.status === "done" ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))"
                      : job.status === "error" ? "color-mix(in oklab, var(--c-danger) 12%, var(--c-surface))"
                      : "color-mix(in oklab, var(--c-primary) 10%, var(--c-surface))",
                    color: job.status === "done" ? "var(--c-success)" : job.status === "error" ? "var(--c-danger)" : "var(--c-primary)",
                  }}>
                    {job.status === "uploading" ? "アップロード中" : job.status === "analyzing" ? "AI解析中" : job.status === "saving" ? "版作成中" : job.status === "done" ? "完了" : "失敗"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!selectedVersion ? (
            <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--c-border)" strokeWidth="1.2"
                style={{ display: "block", margin: "0 auto 16px" }}>
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 6 }}>
                版を選択してください
              </div>
              <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                左パネルの版リストをクリック、または<br />PDFをドロップして新しい版を作成
              </div>
              {quote.versions.length === 0 && (
                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={() => setAddMode("choose")}
                    style={{
                      padding: "8px 20px", fontSize: 13, fontWeight: 600,
                      background: "var(--c-surface)", border: "1.5px solid var(--c-primary)",
                      borderRadius: "var(--r-md)", cursor: "pointer", color: "var(--c-primary)",
                    }}
                  >+ 版を追加</button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 版ヘッダ */}
              <div className="card" style={{ padding: "12px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>業者名</span>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {selectedVersion.vendor_name_snapshot || "（未設定）"}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>全体掛率</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>×</span>
                      <input
                        type="number" step="0.01" min="1"
                        value={markupInput}
                        onChange={e => setMarkupInput(e.target.value)}
                        onBlur={e => handleMarkupChange(selectedVersion.id, e.target.value)}
                        style={{
                          width: 72, fontSize: 14, fontWeight: 600,
                          border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                          padding: "2px 6px", background: "var(--c-surface)",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>（行ごとに上書き可）</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>原価合計</span>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
                      {fmt(editItems.reduce((s, i) => s + (i.cost_price ?? 0) * (i.quantity ?? 0), 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 明細テーブル */}
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>工種・品名</th>
                        <th>仕様</th>
                        <th style={{ width: 56 }}>単位</th>
                        <th className="num" style={{ width: 80 }}>数量</th>
                        <th className="num" style={{ width: 96 }}>原価単価</th>
                        <th className="num" style={{ width: 72 }}>掛率</th>
                        <th className="num" style={{ width: 96 }}>販売単価</th>
                        <th className="num" style={{ width: 104 }}>金額</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ color: "var(--c-text-muted)", fontSize: 11, textAlign: "center" }}>
                            {idx + 1}
                          </td>
                          <td>
                            <input
                              value={item.item_name ?? ""}
                              onChange={e => updateItem(idx, "item_name", e.target.value)}
                              style={cellInputStyle}
                              placeholder="品名"
                            />
                          </td>
                          <td>
                            <input
                              value={item.spec ?? ""}
                              onChange={e => updateItem(idx, "spec", e.target.value)}
                              style={cellInputStyle}
                              placeholder="仕様"
                            />
                          </td>
                          <td>
                            <input
                              value={item.unit ?? ""}
                              onChange={e => updateItem(idx, "unit", e.target.value)}
                              style={{ ...cellInputStyle, textAlign: "center" }}
                              placeholder="式"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.quantity ?? ""}
                              onChange={e => updateItem(idx, "quantity", e.target.value)}
                              style={{ ...cellInputStyle, textAlign: "right", fontFamily: "var(--ff-mono)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.cost_price ?? ""}
                              onChange={e => updateItem(idx, "cost_price", e.target.value)}
                              style={{ ...cellInputStyle, textAlign: "right", fontFamily: "var(--ff-mono)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" step="0.01"
                              value={item.item_markup_rate ?? ""}
                              onChange={e => updateItem(idx, "item_markup_rate", e.target.value)}
                              placeholder={String(selectedVersion.markup_rate)}
                              style={{ ...cellInputStyle, textAlign: "right", fontFamily: "var(--ff-mono)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.unit_price ?? ""}
                              onChange={e => updateItem(idx, "unit_price", e.target.value)}
                              style={{ ...cellInputStyle, textAlign: "right", fontFamily: "var(--ff-mono)" }}
                            />
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--ff-mono)", fontSize: 13, paddingRight: 8 }}>
                            {item.amount != null ? item.amount.toLocaleString() : "—"}
                          </td>
                          <td>
                            <button
                              onClick={() => removeRow(idx)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--c-text-muted)", fontSize: 14, padding: "0 4px",
                              }}
                              title="行を削除"
                            >×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* テーブルフッター：行追加 + 小計 */}
                <div style={{
                  padding: "8px 12px", borderTop: "1px solid var(--c-border)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                }}>
                  <Button size="sm" variant="default" onClick={addRow}>
                    + 行を追加
                  </Button>
                  <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
                    <span style={{ color: "var(--c-text-muted)" }}>
                      小計 <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-text)", fontWeight: 600 }}>
                        {versionSubtotal.toLocaleString()}
                      </span>
                    </span>
                    <span style={{ color: "var(--c-text-muted)" }}>
                      消費税 <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-text)" }}>
                        {versionTax.toLocaleString()}
                      </span>
                    </span>
                    <span style={{ color: "var(--c-text-muted)" }}>
                      合計 <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-primary)", fontWeight: 700, fontSize: 15 }}>
                        {versionTotal.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 11, background: "var(--c-surface-2)", color: "var(--c-text-muted)", border: "1px solid var(--c-border)" }}>
                左の「スキャン」ボタンからPDF/画像をアップロードすると版が自動作成されます。「転記」ボタンで過去案件の業者見積を流用できます。
              </div>
            </>
          )}
        </div>
      </div>
      {/* ── QCDSに反映ダイアログ ── */}
      {qcdsReflectVer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setQcdsReflectVer(null)}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 380, padding: "20px 24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>QCDSに反映</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>業者名</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{qcdsReflectVer.vendor_name_snapshot || "（未設定）"}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 6 }}>カテゴリー</div>
              {(["subcontract", "material", "other"] as const).map(cat => (
                <label key={cat} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13 }}>
                  <input type="radio" name="qcds-cat" checked={qcdsCategory === cat} onChange={() => setQcdsCategory(cat)} />
                  {cat === "subcontract" ? "外注業者" : cat === "material" ? "資材業者" : "その他"}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setQcdsReflectVer(null)} style={{ padding: "6px 16px", fontSize: 13, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleQcdsReflect} disabled={qcdsReflecting} style={{ padding: "6px 20px", fontSize: 13, fontWeight: 600, background: "var(--c-primary)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer" }}>
                {qcdsReflecting ? "反映中…" : "反映する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 顧客見積に反映ダイアログ ── */}
      {quoteReflectVer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setQuoteReflectVer(null)}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", width: 420, padding: "20px 24px" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>顧客見積に反映</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>掛率</div>
              <input type="number" step="0.01" min="0.01" value={reflectMarkup} onChange={e => setReflectMarkup(e.target.value)}
                style={{ width: 100, padding: "5px 8px", fontSize: 13, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)" }} />
              <span style={{ fontSize: 11, color: "var(--c-text-muted)", marginLeft: 8 }}>販売単価 = 原価 × 掛率</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 6 }}>追加先の大項目</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
                <input type="radio" checked={reflectSectionType === "new"} onChange={() => setReflectSectionType("new")} />
                新しい大項目を作成
              </label>
              {reflectSectionType === "new" && (
                <input value={reflectSectionName} onChange={e => setReflectSectionName(e.target.value)}
                  placeholder="大項目名（例: 外壁工事）"
                  style={{ width: "100%", marginLeft: 20, padding: "5px 8px", fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", boxSizing: "border-box" }} />
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 6, cursor: "pointer" }}>
                <input type="radio" checked={reflectSectionType === "existing"} onChange={() => setReflectSectionType("existing")} />
                既存の大項目に追加
              </label>
              {reflectSectionType === "existing" && (
                <select value={reflectSectionId} onChange={e => setReflectSectionId(e.target.value)}
                  style={{ width: "100%", marginLeft: 20, padding: "5px 8px", fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", boxSizing: "border-box" }}>
                  <option value="">選択してください</option>
                  {customerSections.map(s => <option key={s.id} value={s.id}>{s.section_letter}. {s.section_name}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setQuoteReflectVer(null)} style={{ padding: "6px 16px", fontSize: 13, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleQuoteReflect} disabled={quoteReflecting} style={{ padding: "6px 20px", fontSize: 13, fontWeight: 600, background: "var(--c-accent)", color: "#fff", border: "none", borderRadius: "var(--r-md)", cursor: "pointer" }}>
                {quoteReflecting ? "反映中…" : "反映する"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "3px 6px",
  border: "1px solid transparent",
  borderRadius: "var(--r-md)",
  background: "transparent",
  outline: "none",
};
