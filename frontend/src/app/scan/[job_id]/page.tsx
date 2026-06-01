"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, Loader2,
  RotateCcw, Save, Star, X,
} from "lucide-react";
import { ProjectPickerCard } from "@/components/scan/ProjectPickerCard";
import { apiFetch, tokenStore } from "@/lib/api-client";
import { fmtNum } from "@/lib/format";
import { confClass, confStyle, cellBg } from "@/modules/purchase/scanHelpers";
import {
  ScanJobDetail, ScanResult, ScanResultItem,
  ScanResultItemUpdate, ScanResultUpdate,
} from "@/types/scan";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const getToken = () => tokenStore.get() ?? "";

interface VendorCandidate { id: string; vendor_name: string; kana: string | null; }
interface EditableItem extends ScanResultItem { _edited: boolean; }
interface ProjectOption { id: string; project_number: string; project_name: string; }
interface QCDSOption { id: string; }


/** スキャン結果レビュー画面 */
export default function ScanReviewPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<ScanJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Editable header
  const [vendorName, setVendorName] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [quotedDate, setQuotedDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [total, setTotal] = useState("");
  const [editItems, setEditItems] = useState<EditableItem[]>([]);

  // Vendor search
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorMatches, setVendorMatches] = useState<VendorCandidate[]>([]);
  const [showVendorDrop, setShowVendorDrop] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // UI state
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [suggDismissed, setSuggDismissed] = useState(false);

  // Transfer options
  const [linkedProject, setLinkedProject] = useState<ProjectOption | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [qcds, setQcds] = useState<QCDSOption | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      const data = await apiFetch<ScanJobDetail>(`/api/v1/scan/jobs/${job_id}`);
      setJob(data);
      const r: ScanResult | undefined = data.results[0];
      if (r) {
        setVendorName(r.vendor_name_detected || "");
        setVendorId(r.vendor_id || null);
        setVendorQuery(r.vendor_name_detected || "");
        setQuotedDate(r.quoted_date_detected || "");
        setSubtotal(r.subtotal_detected?.toString() || "");
        setTax(r.tax_detected?.toString() || "");
        setTotal(r.total_detected?.toString() || "");
        setEditItems(r.items.map(i => ({ ...i, _edited: false })));
        setSelectedItemIds(new Set(r.items.map(i => i.id)));
      }
      // ジョブに紐付け案件がある場合は自動で案件情報をロード
      if (data.project_id) {
        const proj = await apiFetch<ProjectOption>(`/api/v1/projects/${data.project_id}`).catch(() => null);
        if (proj) setLinkedProject(proj);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [job_id]);

  // Load PDF file URL
  useEffect(() => {
    let url: string | null = null;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/scan/file/${job_id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          setFileUrl(url);
        }
      } catch { /* preview failure is ignored */ }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [job_id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  // Vendor autocomplete
  useEffect(() => {
    if (vendorQuery.length < 2) { setVendorMatches([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await apiFetch<{ items: VendorCandidate[] }>(`/api/v1/vendors?q=${encodeURIComponent(vendorQuery)}&per_page=5`);
        setVendorMatches(d.items || []);
        setShowVendorDrop(true);
      } catch { setVendorMatches([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [vendorQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) setShowVendorDrop(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Load project/QCDS for transfer
  useEffect(() => {
    if (!linkedProject) { setQcds(null); return; }
    (async () => {
      try {
        const q = await apiFetch<{ id: string }>(`/api/v1/projects/${linkedProject.id}/qcds`).catch(() => null);
        setQcds(q);
      } catch { /* ignore */ }
    })();
  }, [linkedProject]);

  async function loadProjects() {
    try {
      const d = await apiFetch<{ items: ProjectOption[] }>("/api/v1/projects?per_page=100");
      setProjects(d.items || []);
    } catch { /* ignore */ }
  }

  function updateItem(id: string, field: keyof EditableItem, value: string) {
    setEditItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const numVal = ["quantity", "unit_price", "amount"].includes(field as string)
        ? (value === "" ? null : parseFloat(value)) : undefined;
      const updated: EditableItem = {
        ...item, _edited: true,
        [field]: numVal !== undefined ? numVal : (value || null),
      };
      // 数量×単価→金額の自動計算
      if (field === "quantity" || field === "unit_price") {
        const q = field === "quantity" ? (value === "" ? null : parseFloat(value)) : item.quantity;
        const up = field === "unit_price" ? (value === "" ? null : parseFloat(value)) : item.unit_price;
        if (q != null && up != null && !isNaN(q) && !isNaN(up)) {
          updated.amount = Math.round(q * up);
        }
      }
      return updated;
    }));
  }

  // 明細変更時に小計・消費税・合計を自動再計算
  useEffect(() => {
    if (editItems.length === 0) return;
    const edited = editItems.some(i => i._edited);
    if (!edited) return;
    const sum = editItems.reduce((s, i) => s + (i.amount ?? 0), 0);
    if (sum > 0) {
      const taxAmt = Math.floor(sum * 0.10);
      setSubtotal(String(sum));
      setTax(String(taxAmt));
      setTotal(String(sum + taxAmt));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItems]);

  async function handleSave() {
    if (!job?.results[0]) return;
    setSaving(true); setSaveMsg(null);
    const resultId = job.results[0].id;
    const itemUpdates: ScanResultItemUpdate[] = editItems
      .filter(i => i._edited)
      .map(i => ({ id: i.id, item_name: i.item_name, spec: i.spec, unit: i.unit, quantity: i.quantity, unit_price: i.unit_price, amount: i.amount }));
    const body: ScanResultUpdate = {
      vendor_name_detected: vendorName || null,
      vendor_id: vendorId,
      quoted_date_detected: quotedDate || null,
      subtotal_detected: subtotal ? parseFloat(subtotal) : null,
      tax_detected: tax ? parseFloat(tax) : null,
      total_detected: total ? parseFloat(total) : null,
      items: itemUpdates.length > 0 ? itemUpdates : undefined,
    };
    try {
      await apiFetch(`/api/v1/scan/results/${resultId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setSaveMsg("保存しました");
      setEditItems(prev => prev.map(i => ({ ...i, _edited: false })));
      await loadJob();
    } catch (e) {
      setSaveMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function handleConfirm() {
    if (!job?.results[0]) return;
    setConfirming(true);
    try {
      const updated = await apiFetch<ScanJobDetail>(`/api/v1/scan/results/${job.results[0].id}/confirm`, { method: "POST" });
      setJob(updated);
      setSaveMsg("確認済みにしました");
    } catch (e) {
      setSaveMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setConfirming(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function handleTransferToQcds() {
    if (!job?.results[0] || !qcds || !linkedProject) return;
    const resultId = job.results[0].id;
    setTransferring(true); setApplyMsg(null);
    try {
      const r = await apiFetch<{ vendor_name: string | null; total_amount: number }>(`/api/v1/scan/results/${resultId}/transfer-to-qcds`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qcds_id: qcds.id }),
      });
      setApplyMsg(`QCDSに転記しました（${r.vendor_name ?? "業者名不明"} ¥${r.total_amount.toLocaleString("ja-JP")}）。3秒後に移動します…`);
      await loadJob();
      setTimeout(() => router.push(`/projects/${linkedProject.id}/qcds`), 3000);
    } catch (e) {
      setApplyMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setTransferring(false);
    }
  }

  async function handleSaveAsVersion() {
    if (!job?.results[0] || !linkedProject) return;
    const resultId = job.results[0].id;
    setTransferring(true); setApplyMsg(null);
    try {
      const r = await apiFetch<{ version_no: number; vendor_name_snapshot: string | null; item_count: number }>(`/api/v1/scan/results/${resultId}/save-as-version`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: linkedProject.id }),
      });
      setApplyMsg(`業者見積版 ${r.version_no} として保存しました（${r.item_count}行）。3秒後に移動します…`);
      await loadJob();
      setTimeout(() => router.push(`/projects/${linkedProject.id}/estimate`), 3000);
    } catch (e) {
      setApplyMsg(`エラー: ${(e as Error).message}`);
    } finally {
      setTransferring(false);
    }
  }

  const result = job?.results[0] ?? null;
  const isEditable = job?.status === "succeeded" || job?.status === "reviewed";
  const isReviewed = job?.status === "reviewed";

  // Stats
  const lowConfItems = editItems.filter(i => i.confidence != null && i.confidence < 0.75);
  const overallConf = result?.confidence_score ?? null;
  const confCls = confClass(overallConf);

  // Loading / error states
  if (loading) return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--c-bg)" }}>
      <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--c-primary)" }} />
    </div>
  );

  if (error || !job) return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--c-bg)", flexDirection: "column", gap: 12 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--c-danger)", marginBottom: 12 }}>認証情報が無効です</p>
        <Link href="/scan" style={{ color: "var(--c-primary)" }}>一覧に戻る</Link>
      </div>
    </div>
  );

  const canTransferToQcds = !!linkedProject && !!qcds;
  const canSaveAsVersion = !!linkedProject;

  return (
    <div style={{
      display: "grid",
      gridTemplateRows: "52px auto auto 1fr",
      height: "100vh",
      background: "var(--c-bg)",
      overflow: "hidden",
    }}>

      {/* ── topbar ── */}
      <div style={{
        height: 52, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
        display: "flex", alignItems: "center", gap: 14, padding: "0 18px",
      }}>
        <Link href="/scan" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--c-text-muted)", textDecoration: "none", fontSize: 13, fontWeight: 500,
        }}>
          <ArrowLeft size={14} />
          スキャン一覧へ
        </Link>
        <span style={{ color: "var(--c-text-subtle)" }}>/</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
          border: "1px solid color-mix(in oklab, var(--c-primary) 25%, var(--c-border))",
          color: "var(--c-primary)", padding: "3px 9px", borderRadius: "var(--r-pill)",
          fontSize: 11, fontWeight: 600, fontFamily: "var(--ff-mono)",
        }}>
          <Star size={11} />
          AI 解析結果
        </span>
        <strong style={{ fontSize: 13 }}>{job.original_file_name}</strong>
        <div style={{ flex: 1 }} />
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
            {saveMsg}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "var(--ff-mono)" }}>
          解析: {new Date(job.updated_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · Gemini 2.5 Pro
        </span>
        <a
          href={`${API_URL}/api/v1/scan/file/${job_id}`}
          onClick={async (e) => {
            e.preventDefault();
            const token = getToken();
            if (!token) return;
            const res = await fetch(`${API_URL}/api/v1/scan/file/${job_id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = job.original_file_name; a.click();
              URL.revokeObjectURL(url);
            }
          }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px",
            background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
            borderRadius: "var(--r-md)", fontSize: 12, color: "var(--c-text)", textDecoration: "none",
          }}
        >
          <FileText size={12} />
          原本DL
        </a>
        <button
          onClick={() => { setLoading(true); loadJob(); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px",
            background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
            borderRadius: "var(--r-md)", fontSize: 12, color: "var(--c-text)", cursor: "pointer",
          }}
        >
          <RotateCcw size={12} />
          再解析
        </button>
      </div>

      {/* ── job summary bar ── */}
      {result && (
        <div style={{
          background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
          display: "grid", gridTemplateColumns: "auto 1fr auto",
          alignItems: "center", gap: 22, padding: "12px 18px",
        }}>
          {/* vendor info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--r-md)",
              background: "color-mix(in oklab,var(--c-danger) 14%,var(--c-surface))",
              color: "var(--c-danger)", display: "grid", placeItems: "center",
            }}>
              <FileText size={16} strokeWidth={1.6} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {vendorName || "（業者名未検出）"}
              </div>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "var(--ff-mono)", marginTop: 1 }}>
                {quotedDate || "見積日未検出"}
              </div>
            </div>
          </div>

          {/* stats */}
          <div style={{ display: "flex", gap: 22 }}>
            {[
              { k: "合計金額", v: total ? `¥${parseFloat(total).toLocaleString("ja-JP")}` : "—" },
              { k: "項目数",   v: `${editItems.length}` },
              { k: "全体信頼度", v: overallConf != null ? `${Math.round(overallConf * 100)}%` : "—", color: confCls === "h" ? "var(--c-success)" : confCls === "m" ? "var(--c-warn)" : undefined },
              { k: "要確認",  v: `${lowConfItems.length}件`, color: lowConfItems.length > 0 ? "var(--c-warn)" : undefined },
            ].map(s => (
              <div key={s.k}>
                <div style={{ fontSize: 10, color: "var(--c-text-muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.k}</div>
                <div style={{ fontFamily: "var(--ff-mono)", fontSize: 14, fontWeight: 700, marginTop: 1, color: s.color }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* confidence meter */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--c-text-muted)" }}>
            <div style={{
              width: 140, height: 8, background: "var(--c-surface-3)",
              borderRadius: "var(--r-pill)", display: "flex", overflow: "hidden",
            }}>
              {(() => {
                const h = editItems.filter(i => i.confidence != null && i.confidence >= 0.85).length;
                const m = editItems.filter(i => i.confidence != null && i.confidence >= 0.60 && i.confidence < 0.85).length;
                const l = editItems.filter(i => i.confidence != null && i.confidence < 0.60).length;
                const total2 = h + m + l || 1;
                return <>
                  <div style={{ flex: h / total2, background: "var(--c-success)", height: "100%" }} />
                  <div style={{ flex: m / total2, background: "var(--c-warn)", height: "100%" }} />
                  <div style={{ flex: l / total2, background: "var(--c-danger)", height: "100%" }} />
                </>;
              })()}
            </div>
            <span>
              <span style={{ color: "var(--c-success)", fontWeight: 600 }}>
                {editItems.filter(i => i.confidence != null && i.confidence >= 0.85).length}
              </span>
              {" · "}
              <span style={{ color: "var(--c-warn)", fontWeight: 600 }}>
                {editItems.filter(i => i.confidence != null && i.confidence >= 0.60 && i.confidence < 0.85).length}
              </span>
              {" · "}
              <span style={{ color: "var(--c-danger)", fontWeight: 600 }}>
                {editItems.filter(i => i.confidence != null && i.confidence < 0.60).length}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── project picker card ── */}
      <div style={{ borderBottom: "1px solid var(--c-border)", background: "var(--c-bg)", padding: "12px 18px" }}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProjectPickerCard
              linkedProject={linkedProject}
              candidates={projects}
              onSelect={(p) => setLinkedProject(p)}
              onClear={() => { setLinkedProject(null); setQcds(null); }}
              onLoadCandidates={() => { if (projects.length === 0) loadProjects(); }}
            />
          </div>
          {!isReviewed && (
            <button
              onClick={handleConfirm}
              disabled={confirming || !isEditable}
              title="内容を確認済みとしてマークします（転記完了後に押してください）"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
                background: "color-mix(in oklab, var(--c-success) 10%, var(--c-surface))",
                border: "1px solid color-mix(in oklab, var(--c-success) 35%, var(--c-border))",
                borderRadius: "var(--r-md)", fontSize: 12, cursor: confirming ? "not-allowed" : "pointer",
                color: "var(--c-success)", fontWeight: 600, flexShrink: 0,
              }}
            >
              {confirming ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : null}
              確認済みにする
            </button>
          )}
        </div>
      </div>

      {/* ── split ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", minHeight: 0, overflow: "hidden" }}>

        {/* LEFT: PDF viewer */}
        <div style={{
          overflow: "auto", minWidth: 0, borderRight: "1px solid var(--c-border)",
          background: "var(--c-surface-2)", display: "flex", flexDirection: "column",
        }}>
          {/* pdf toolbar */}
          <div style={{
            position: "sticky", top: 0, zIndex: 5,
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)",
            padding: "8px 12px", fontSize: 12, color: "var(--c-text-muted)",
          }}>
            <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11 }}>1 / 1</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11 }}>バウンディングボックス</span>
            <span style={{
              padding: "2px 8px", background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-md)", fontSize: 11,
            }}>非対応</span>
            <div style={{
              display: "inline-flex", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", overflow: "hidden",
            }}>
              {["−", "75%", "+"].map(z => (
                <span key={z} style={{
                  background: "var(--c-surface)", padding: "4px 8px",
                  borderRight: z !== "+" ? "1px solid var(--c-border)" : "none",
                  fontSize: 11, fontFamily: "var(--ff-mono)", cursor: "pointer",
                }}>{z}</span>
              ))}
            </div>
          </div>

          {/* PDF content */}
          <div style={{ flex: 1, padding: "18px 24px 60px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {fileUrl ? (
              <iframe
                src={fileUrl}
                style={{ width: "100%", maxWidth: 560, height: "80vh", border: "none", boxShadow: "0 8px 24px rgba(17,24,39,0.15)" }}
                title="スキャンファイルプレビュー"
              />
            ) : (
              <div style={{
                width: "100%", maxWidth: 560, minHeight: 400, background: "var(--c-surface)",
                display: "grid", placeItems: "center", borderRadius: "var(--r-md)",
                boxShadow: "0 8px 24px rgba(17,24,39,0.15)",
              }}>
                <div style={{ textAlign: "center", color: "var(--c-text-muted)", fontSize: 13 }}>
                  <FileText size={40} style={{ opacity: 0.3, marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                  プレビューを読み込み中…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Extracted data */}
        <div style={{ overflow: "auto", minWidth: 0, background: "var(--c-bg)" }}>

          {/* How-to guide */}
          {!isReviewed && (
            <div style={{
              margin: "12px 18px 0",
              background: "var(--c-info-bg)",
              border: "1px solid color-mix(in oklab, var(--c-info) 28%, var(--c-border))",
              borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>スキャン結果レビューの手順</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, color: "var(--c-text)", lineHeight: 1.6 }}>
                <div><span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, color: "var(--c-primary)", marginRight: 8 }}>①</span>左のPDFと右の抽出内容を照合。黄背景・<span style={{ display:"inline-flex",width:14,height:14,borderRadius:"50%",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",background:"var(--c-warn)",verticalAlign:"middle",margin:"0 2px"}}>!</span>マークの箇所を重点確認</div>
                <div><span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, color: "var(--c-primary)", marginRight: 8 }}>②</span>数値を修正すると金額・小計・合計が自動計算されます。「編集を保存」で確定</div>
                <div><span style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, color: "var(--c-primary)", marginRight: 8 }}>③</span>下の「転記先」で転記したい案件・見積書・QCDSを選択して「選択先に転記する」を押す</div>
              </div>
            </div>
          )}

          {/* AI suggestion */}
          {!suggDismissed && result?.vendor_id && (
            <div style={{
              background: "color-mix(in oklab, var(--c-info) 6%, var(--c-surface))",
              border: "1px solid color-mix(in oklab, var(--c-info) 25%, var(--c-border))",
              borderRadius: "var(--r-md)", padding: "10px 14px",
              margin: "12px 18px", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <div style={{
                width: 22, height: 22, background: "var(--c-info)", color: "#fff",
                borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <Star size={12} />
              </div>
              <div style={{ flex: 1, lineHeight: 1.5 }}>
                <strong style={{ display: "block", fontWeight: 700, marginBottom: 2 }}>
                  過去取引と一致 — 業者マスタへの紐付け候補あり
                </strong>
                「{vendorName}」は業者マスタに登録されています。転記時に単価履歴が自動記録されます。
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setSuggDismissed(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2 }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ① Header card */}
          <div style={{ background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
            <div style={{
              padding: "12px 18px", display: "flex", alignItems: "center", gap: 10,
              borderBottom: headerCollapsed ? "none" : "1px solid var(--c-border)",
            }}>
              <span style={{
                background: "var(--c-primary)", color: "#fff",
                width: 22, height: 22, borderRadius: "var(--r-sm)",
                display: "grid", placeItems: "center",
                fontWeight: 800, fontFamily: "var(--ff-mono)", fontSize: 12,
              }}>①</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>ヘッダー情報</div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>業者・見積番号・合計など</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                {overallConf != null && (
                  <span style={{
                    fontSize: 11, fontFamily: "var(--ff-mono)", fontWeight: 600,
                    padding: "1px 7px", borderRadius: "var(--r-pill)", ...confStyle(confCls),
                  }}>
                    {Math.round(overallConf * 100)}%
                  </span>
                )}
                <button
                  onClick={() => setHeaderCollapsed(v => !v)}
                  style={{ background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "3px 8px", fontSize: 12, cursor: "pointer", color: "var(--c-text-muted)" }}
                >
                  {headerCollapsed ? "展開" : "折り畳む"}
                </button>
              </div>
            </div>

            {!headerCollapsed && (
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr" }}>
                {/* vendor name with autocomplete */}
                {[
                  {
                    label: "業者名", content: (
                      <div ref={vendorRef} style={{ position: "relative", width: "100%" }}>
                        <input
                          value={vendorQuery}
                          onChange={e => { setVendorQuery(e.target.value); setVendorName(e.target.value); }}
                          disabled={!isEditable}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: "transparent", border: 0, outline: 0,
                            color: "var(--c-text)", fontSize: 13, fontFamily: "inherit",
                          }}
                        />
                        {showVendorDrop && vendorMatches.length > 0 && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                            background: "var(--c-surface)", border: "1px solid var(--c-border)",
                            borderRadius: "var(--r-md)", boxShadow: "var(--sh-2)", overflow: "hidden",
                          }}>
                            {vendorMatches.map(v => (
                              <button key={v.id} onClick={() => { setVendorName(v.vendor_name); setVendorId(v.id); setVendorQuery(v.vendor_name); setShowVendorDrop(false); }}
                                style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                              >{v.vendor_name}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  },
                  { label: "見積日",     content: <input value={quotedDate} onChange={e => setQuotedDate(e.target.value)} disabled={!isEditable} style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: 0, outline: 0, color: "var(--c-text)", fontSize: 13 }} /> },
                  { label: "合計（税抜）", content: <input value={subtotal} onChange={e => setSubtotal(e.target.value)} disabled={!isEditable} style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: 0, outline: 0, color: "var(--c-text)", fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 600 }} /> },
                  { label: "消費税",     content: <input value={tax} onChange={e => setTax(e.target.value)} disabled={!isEditable} style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: 0, outline: 0, color: "var(--c-text)", fontSize: 13, fontFamily: "var(--ff-mono)" }} /> },
                  { label: "合計（税込）", content: <input value={total} onChange={e => setTotal(e.target.value)} disabled={!isEditable} style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: 0, outline: 0, color: "var(--c-text)", fontSize: 13, fontFamily: "var(--ff-mono)", fontWeight: 600 }} /> },
                ].map((row, idx, arr) => (
                  <>
                    <div key={`k-${idx}`} style={{
                      background: "var(--c-surface-2)", padding: "9px 14px",
                      fontSize: 12, color: "var(--c-text-muted)", fontWeight: 500,
                      borderBottom: idx < arr.length - 1 ? "1px solid var(--c-border)" : "none",
                      display: "flex", alignItems: "center",
                    }}>{row.label}</div>
                    <div key={`v-${idx}`} style={{
                      padding: "9px 14px",
                      borderBottom: idx < arr.length - 1 ? "1px solid var(--c-border)" : "none",
                      borderLeft: "1px solid var(--c-border)",
                      fontSize: 13, display: "flex", alignItems: "center",
                      cursor: isEditable ? "text" : "default",
                    }}>{row.content}</div>
                  </>
                ))}
              </div>
            )}
          </div>

          {/* ② Items table */}
          <div style={{ background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
            <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--c-border)" }}>
              <span style={{
                background: "var(--c-primary)", color: "#fff", width: 22, height: 22,
                borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
                fontWeight: 800, fontFamily: "var(--ff-mono)", fontSize: 12,
              }}>②</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>明細</div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>
                  {editItems.length}項目 · 黄背景=要確認 · クリックで編集
                </div>
              </div>
              {result && (
                <div style={{ marginLeft: "auto" }}>
                  <span style={{
                    fontSize: 11, fontFamily: "var(--ff-mono)", fontWeight: 600,
                    padding: "1px 7px", borderRadius: "var(--r-pill)",
                    ...confStyle(confClass(result.confidence_score)),
                  }}>
                    {result.confidence_score != null ? `${Math.round(result.confidence_score * 100)}%` : "—"}
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding: "10px 18px 16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {[
                      { label: "No", w: 30, align: "center" as const },
                      { label: "項目", w: undefined, align: "left" as const },
                      { label: "数量", w: 60, align: "right" as const },
                      { label: "単位", w: 48, align: "left" as const },
                      { label: "単価", w: 90, align: "right" as const },
                      { label: "金額", w: 96, align: "right" as const },
                      { label: "信頼", w: 60, align: "right" as const },
                    ].map(col => (
                      <th key={col.label} style={{
                        border: "1px solid var(--c-border)", padding: "6px 10px", height: 32,
                        background: "var(--c-surface-2)", color: "var(--c-text-muted)",
                        fontWeight: 600, fontSize: 11, textAlign: col.align,
                        letterSpacing: "0.02em", width: col.w,
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, rowIdx) => {
                    const cc = confClass(item.confidence);
                    const bg = cellBg(item.confidence);
                    const isLowConf = item.confidence != null && item.confidence < 0.75;
                    return (
                      <tr key={item.id}>
                        <td style={{
                          border: "1px solid var(--c-border)", padding: "6px 10px", height: 32,
                          textAlign: "center", color: "var(--c-text-muted)", fontFamily: "var(--ff-mono)",
                          background: "var(--c-surface-2)", width: 28,
                        }}>{rowIdx + 1}</td>
                        {[
                          { field: "item_name" as const, value: item.item_name, numeric: false, hasMark: isLowConf },
                          { field: "quantity"  as const, value: item.quantity?.toString() ?? "", numeric: true, hasMark: false },
                          { field: "unit"      as const, value: item.unit, numeric: false, hasMark: false },
                          { field: "unit_price" as const, value: item.unit_price?.toString() ?? "", numeric: true, hasMark: isLowConf },
                          { field: "amount"    as const, value: item.amount?.toString() ?? "", numeric: true, hasMark: false },
                        ].map(col => (
                          <td key={col.field} style={{
                            border: "1px solid var(--c-border)", padding: "0 10px", height: 32,
                            textAlign: col.numeric ? "right" : "left",
                            fontFamily: col.numeric ? "var(--ff-mono)" : "inherit",
                            background: col.hasMark && bg ? bg : "var(--c-surface)",
                            cursor: isEditable ? "text" : "default",
                          }}>
                            {col.hasMark && <span style={{ display: "inline-flex", width: 12, height: 12, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff", background: cc === "l" ? "var(--c-danger)" : "var(--c-warn)", marginRight: 4, verticalAlign: "middle" }}>!</span>}
                            <input
                              value={col.value ?? ""}
                              onChange={e => isEditable && updateItem(item.id, col.field, e.target.value)}
                              readOnly={!isEditable}
                              style={{
                                background: "transparent", border: 0, outline: 0,
                                color: "var(--c-text)", fontSize: 12, width: "100%",
                                textAlign: col.numeric ? "right" : "left",
                                fontFamily: col.numeric ? "var(--ff-mono)" : "inherit",
                              }}
                            />
                          </td>
                        ))}
                        <td style={{
                          border: "1px solid var(--c-border)", padding: "6px 10px", height: 32,
                          textAlign: "right", background: "var(--c-surface)",
                        }}>
                          {item.confidence != null ? (
                            <span style={{
                              fontSize: 11, fontFamily: "var(--ff-mono)", fontWeight: 600,
                              padding: "1px 6px", borderRadius: "var(--r-pill)", ...confStyle(cc),
                            }}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {/* subtotal row — state値を使用（明細編集で即時反映） */}
                  {(subtotal || tax || total) && (
                    <>
                      {subtotal && (
                        <tr>
                          <td colSpan={5} style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)", fontWeight: 700 }}>小計（税抜）</td>
                          <td style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)", fontWeight: 700, fontFamily: "var(--ff-mono)" }}>{parseFloat(subtotal).toLocaleString("ja-JP")}</td>
                          <td style={{ border: "1px solid var(--c-border)", background: "var(--c-surface-2)" }} />
                        </tr>
                      )}
                      {tax && (
                        <tr>
                          <td colSpan={5} style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)" }}>消費税（10%）</td>
                          <td style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)", fontFamily: "var(--ff-mono)" }}>{parseFloat(tax).toLocaleString("ja-JP")}</td>
                          <td style={{ border: "1px solid var(--c-border)", background: "var(--c-surface-2)" }} />
                        </tr>
                      )}
                      {total && (
                        <tr>
                          <td colSpan={5} style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)", color: "var(--c-primary)", fontWeight: 700 }}>御見積金額（税込）</td>
                          <td style={{ border: "1px solid var(--c-border)", padding: "6px 10px", textAlign: "right", background: "var(--c-surface-2)", color: "var(--c-primary)", fontWeight: 700, fontFamily: "var(--ff-mono)" }}>¥{parseFloat(total).toLocaleString("ja-JP")}</td>
                          <td style={{ border: "1px solid var(--c-border)", background: "var(--c-surface-2)" }} />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ③ 転記先アクション */}
          <div style={{ background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
            <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--c-border)" }}>
              <span style={{
                background: "var(--c-accent)", color: "#fff", width: 22, height: 22,
                borderRadius: "var(--r-sm)", display: "grid", placeItems: "center",
                fontWeight: 800, fontFamily: "var(--ff-mono)", fontSize: 12,
              }}>③</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>転記先を選択</div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>案件を選択後、転記先を選択してください</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "16px 18px" }}>
              {/* QCDS に転記 */}
              <div style={{
                border: `1.5px solid ${canTransferToQcds ? "var(--c-primary)" : "var(--c-border)"}`,
                borderRadius: "var(--r-md)", padding: 14,
                background: canTransferToQcds ? "color-mix(in oklab, var(--c-primary) 6%, var(--c-surface))" : "var(--c-surface-2)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>QCDSに転記</div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)", lineHeight: 1.5 }}>
                  業者名＋合計金額で 1 行追加<br />
                  個別明細は業者見積版に保存されます
                </div>
                {linkedProject && (
                  <span style={{ fontSize: 11, color: "var(--c-primary)", fontFamily: "var(--ff-mono)", background: "var(--c-surface)", padding: "1px 6px", borderRadius: 2, width: "fit-content" }}>
                    {linkedProject.project_number} / QCDS
                  </span>
                )}
                {!linkedProject && (
                  <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>案件を選択してください</span>
                )}
                {linkedProject && !qcds && (
                  <span style={{ fontSize: 11, color: "var(--c-warn)" }}>この案件にQCDSがありません</span>
                )}
                <button
                  onClick={handleTransferToQcds}
                  disabled={!canTransferToQcds || transferring}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 14px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600,
                    background: canTransferToQcds ? "var(--c-primary)" : "var(--c-surface-3)",
                    color: canTransferToQcds ? "#fff" : "var(--c-text-muted)",
                    border: "none", cursor: canTransferToQcds ? "pointer" : "not-allowed", marginTop: 4,
                  }}
                >
                  {transferring ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  QCDSに転記する
                </button>
              </div>

              {/* 業者見積として保存 */}
              <div style={{
                border: `1.5px solid ${canSaveAsVersion ? "var(--c-accent)" : "var(--c-border)"}`,
                borderRadius: "var(--r-md)", padding: 14,
                background: canSaveAsVersion ? "color-mix(in oklab, var(--c-accent) 6%, var(--c-surface))" : "var(--c-surface-2)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>業者見積として保存</div>
                <div style={{ fontSize: 11, color: "var(--c-text-muted)", lineHeight: 1.5 }}>
                  個別明細を業者見積版として保存<br />
                  QCDSへの転記はしません
                </div>
                {linkedProject && (
                  <span style={{ fontSize: 11, color: "var(--c-accent)", fontFamily: "var(--ff-mono)", background: "var(--c-surface)", padding: "1px 6px", borderRadius: 2, width: "fit-content" }}>
                    {linkedProject.project_number} / 業者見積
                  </span>
                )}
                {!linkedProject && (
                  <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>案件を選択してください</span>
                )}
                <button
                  onClick={handleSaveAsVersion}
                  disabled={!canSaveAsVersion || transferring}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 14px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600,
                    background: canSaveAsVersion ? "var(--c-accent)" : "var(--c-surface-3)",
                    color: canSaveAsVersion ? "#fff" : "var(--c-text-muted)",
                    border: "none", cursor: canSaveAsVersion ? "pointer" : "not-allowed", marginTop: 4,
                  }}
                >
                  {transferring ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  業者見積として保存
                </button>
              </div>
            </div>

            {/* sticky action bar */}
            <div style={{
              borderTop: "1px solid var(--c-border)", background: "var(--c-surface)",
              padding: "14px 22px", display: "flex", alignItems: "center", gap: 12,
              position: "sticky", bottom: 0,
            }}>
              <div style={{ display: "flex", gap: 18, fontSize: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>選択項目数</div>
                  <div style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, fontSize: 14 }}>{selectedItemIds.size}</div>
                </div>
                {lowConfItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>残レビュー</div>
                    <div style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, fontSize: 14, color: "var(--c-warn)" }}>{lowConfItems.length}件</div>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }} />
              {applyMsg && (
                <span style={{ fontSize: 13, color: applyMsg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
                  {applyMsg}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !isEditable}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px",
                  background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-md)", fontSize: 13, cursor: "pointer", color: "var(--c-text)",
                }}
              >
                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                編集を保存
              </button>
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: "7px 14px", background: "var(--c-surface-2)",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  fontSize: 13, cursor: "pointer", color: "var(--c-text)",
                }}
              >後で</button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
