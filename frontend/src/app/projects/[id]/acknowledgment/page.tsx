"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, ChevronDown, Download, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { fmtYen } from "@/lib/format";
import { AcknowledgmentRead } from "@/types/acknowledgment";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

// ── ステータス定義（注文書デザイン準拠） ─────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; border: string; bg: string; text: string }> = {
  draft:  { label: "下書き",   dot: "var(--c-text-muted)", border: "var(--c-text-muted)", bg: "var(--c-surface)",                                bg2: "var(--c-text-muted)",  text: "var(--c-text-muted)" },
  issued: { label: "発行済み", dot: "#7c3aed",             border: "#7c3aed",             bg: "color-mix(in oklab,#7c3aed 10%,var(--c-surface))", bg2: "#7c3aed",              text: "#7c3aed" },
} as Record<string, { label: string; dot: string; border: string; bg: string; text: string }>;

function stampTaxDesc(total: number | null): string {
  if (!total) return "";
  if (total <= 200000)  return "第2号文書（請負）/ 100万円超 〜 200万円以下 · 軽減税率適用";
  if (total <= 3000000) return "第2号文書（請負）/ 200万円超 〜 300万円以下";
  return "第2号文書（請負）";
}

// ── ステータスバッジ ────────────────────────────────────────────────
function StatusBadge({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const m = STATUS_META[status] || STATUS_META.draft;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: "var(--r-md)",
        border: `1.5px solid ${m.border}`,
        fontSize: 12, fontWeight: 700, cursor: "pointer",
        background: m.bg, color: m.text,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
        {m.label}
        <ChevronDown size={11} style={{ color: "var(--c-text-muted)" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
          background: "var(--c-surface)", border: "1px solid var(--c-border)",
          borderRadius: "var(--r-md)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          minWidth: 130, overflow: "hidden",
        }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "8px 12px", border: "none",
              background: status === key ? "var(--c-surface-2)" : "none",
              cursor: "pointer", fontSize: 12, fontWeight: status === key ? 700 : 400,
              textAlign: "left", color: meta.text,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot }} />
              {meta.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── タイムライン（2ステップ） ─────────────────────────────────────────
function TlArrow() {
  return (
    <svg style={{ color: "var(--c-text-muted)", flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
const ACK_STEPS = [
  { key: "draft",  label: "下書き" },
  { key: "issued", label: "発行済み（issued）" },
];
function Timeline({ status, issueDate }: { status: string; issueDate: string | null }) {
  const stepIdx = status === "issued" ? 1 : 0;
  return (
    <div style={{
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      borderRadius: "var(--r-lg)", padding: "14px 18px", marginBottom: 14,
      display: "flex", gap: 12, alignItems: "center",
    }}>
      {ACK_STEPS.map((step, i) => {
        const done = i < stepIdx;
        const cur  = i === stepIdx;
        return (
          <div key={step.key} style={{ display: "contents" }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 11,
              color: done ? "var(--c-text)" : cur ? "#7c3aed" : "var(--c-text-muted)",
              fontWeight: cur ? 700 : 400,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 700, fontFamily: "var(--ff-mono)",
                background: done ? "var(--c-success)" : cur ? "#7c3aed" : "var(--c-surface-2)",
                border: `1.5px solid ${done ? "var(--c-success)" : cur ? "#7c3aed" : "var(--c-border)"}`,
                color: done || cur ? "#fff" : "var(--c-text-muted)",
              }}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{step.label}</div>
                {i === 0 && issueDate && (
                  <div style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--c-text-muted)" }}>{issueDate}</div>
                )}
              </div>
            </div>
            {i < ACK_STEPS.length - 1 && <TlArrow />}
          </div>
        );
      })}
    </div>
  );
}

// ── フィールドグリッドセル ────────────────────────────────────────────
function K({ children, noBorder }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{
      padding: "9px 12px", fontSize: 12, fontWeight: 500,
      background: "var(--c-surface-2)", color: "var(--c-text-muted)",
      borderBottom: noBorder ? "none" : "1px solid var(--c-border)",
      borderRight: "1px solid var(--c-border)",
      display: "flex", alignItems: "center", minHeight: 36,
    }}>
      {children}
    </div>
  );
}
function V({
  value, onChange, span2, type = "text", multiline, placeholder, mono, noBorder, disabled,
}: {
  value: string; onChange?: (v: string) => void;
  span2?: boolean; type?: string; multiline?: boolean;
  placeholder?: string; mono?: boolean; noBorder?: boolean; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isEmpty = !value;
  const canEdit = !disabled && !!onChange;

  const cellStyle: React.CSSProperties = {
    padding: "9px 12px", fontSize: 13,
    borderBottom: noBorder ? "none" : "1px solid var(--c-border)",
    borderRight: span2 ? "none" : "1px solid var(--c-border)",
    display: "flex", alignItems: multiline ? "flex-start" : "center", minHeight: 36,
    gridColumn: span2 ? "2 / span 3" : undefined,
    cursor: canEdit ? "pointer" : "default",
    background: editing ? "color-mix(in oklab,var(--c-primary) 4%,var(--c-surface))"
      : disabled ? "var(--c-surface-2)" : "var(--c-surface)",
    fontFamily: mono ? "var(--ff-mono)" : undefined,
  };

  if (editing && canEdit) {
    const inputStyle: React.CSSProperties = {
      width: "100%", border: "none", outline: "none",
      background: "transparent", fontSize: 13, color: "var(--c-text)",
      fontFamily: mono ? "var(--ff-mono)" : undefined,
    };
    return (
      <div style={cellStyle}>
        {multiline ? (
          <textarea autoFocus value={draft} rows={3}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange!(draft); setEditing(false); }}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <input autoFocus type={type} value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange!(draft); setEditing(false); }}
            onKeyDown={e => {
              if (e.key === "Enter") { onChange!(draft); setEditing(false); }
              if (e.key === "Escape") setEditing(false);
            }}
            style={inputStyle} placeholder={placeholder}
          />
        )}
      </div>
    );
  }

  return (
    <div style={cellStyle}
      onClick={() => { if (canEdit) { setDraft(value); setEditing(true); } }}
      title={canEdit ? "クリックして編集" : undefined}
    >
      {isEmpty
        ? <span style={{ color: "var(--c-text-muted)", fontSize: 11 }}>—</span>
        : <span style={{ lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{value}</span>
      }
    </div>
  );
}

/** 注文請書管理画面 — 注文書デザイン準拠 */
export default function AcknowledgmentPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [acks, setAcks]       = useState<AcknowledgmentRead[]>([]);
  const [selected, setSelected] = useState<AcknowledgmentRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // 編集フォーム状態
  const [issueDate, setIssueDate]         = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientPerson, setClientPerson]   = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [periodStart, setPeriodStart]     = useState("");
  const [periodEnd, setPeriodEnd]         = useState("");
  const [paymentCondition, setPaymentCondition] = useState("");
  const [terms, setTerms]                 = useState("");

  useEffect(() => { loadAcks(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAcks(keepId?: string) {
    setLoading(true);
    try {
      const data = await apiFetch<AcknowledgmentRead[]>(`/api/v1/projects/${projectId}/acknowledgments`);
      setAcks(data);
      if (data.length > 0) {
        const toSelect = keepId ? (data.find(a => a.id === keepId) ?? data[0]) : data[0];
        selectAck(toSelect);
      } else { setSelected(null); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function selectAck(a: AcknowledgmentRead) {
    setSelected(a);
    setIssueDate(a.issue_date || "");
    setClientCompany(a.client_company || "");
    setClientPerson(a.client_person || "");
    setClientAddress(a.client_address || "");
    setPeriodStart(a.construction_period_start || "");
    setPeriodEnd(a.construction_period_end || "");
    setPaymentCondition(a.payment_condition || "");
    setTerms(a.terms_and_conditions || "");
  }

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 4000); };

  /** 注文書のデータをこの注文請書に反映する */
  async function handleImportFromOrder() {
    try {
      const orders = await apiFetch<{
        id: string; order_number: string | null; issue_date: string | null;
        client_company: string | null; client_person: string | null; client_address: string | null;
        construction_period_start: string | null; construction_period_end: string | null;
        payment_condition: string | null; status: string;
      }[]>(`/api/v1/projects/${projectId}/orders`);
      const issuedOrders = orders.filter(o => o.status === "sent" || o.status === "signed");
      const target = issuedOrders.length > 0 ? issuedOrders[issuedOrders.length - 1] : orders[orders.length - 1];
      if (!target) { showMsg("注文書がありません"); return; }
      if (!confirm(`「${target.order_number || "注文書"}」のデータを注文請書に反映しますか？`)) return;
      if (target.issue_date) setIssueDate(target.issue_date);
      if (target.client_company) setClientCompany(target.client_company);
      if (target.client_person) setClientPerson(target.client_person);
      if (target.client_address) setClientAddress(target.client_address);
      if (target.construction_period_start) setPeriodStart(target.construction_period_start);
      if (target.construction_period_end) setPeriodEnd(target.construction_period_end);
      if (target.payment_condition) setPaymentCondition(target.payment_condition);
      showMsg(`✓ 注文書「${target.order_number || "注文書"}」のデータを反映しました。保存ボタンで確定してください。`);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/acknowledgments/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          issue_date: issueDate || null,
          client_company: clientCompany || null,
          client_person: clientPerson || null,
          client_address: clientAddress || null,
          construction_period_start: periodStart || null,
          construction_period_end: periodEnd || null,
          payment_condition: paymentCondition || null,
          terms_and_conditions: terms || null,
        }),
      });
      showMsg("保存しました");
      await loadAcks(selected.id);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selected) return;
    const currentId = selected.id;
    try {
      await apiFetch(`/api/v1/acknowledgments/${selected.id}`, {
        method: "PATCH", body: JSON.stringify({ status: newStatus }),
      });
      showMsg("ステータスを更新しました");
      await loadAcks(currentId);
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleDeleteSelected() {
    if (checkedIds.size === 0) return;
    if (!confirm(`選択した ${checkedIds.size} 件の注文請書を削除しますか？`)) return;
    setDeleting(true);
    try {
      await Promise.all([...checkedIds].map(id =>
        apiFetch(`/api/v1/acknowledgments/${id}`, { method: "DELETE" })
      ));
      setCheckedIds(new Set());
      await loadAcks(selected && !checkedIds.has(selected.id) ? selected.id : undefined);
      showMsg("削除しました");
    } catch (e) { showMsg(`削除エラー: ${(e as Error).message}`); }
    finally { setDeleting(false); }
  }

  const isIssued = selected?.status === "issued";

  // ヘッダー生成
  const heroTitle    = clientCompany ? `${clientCompany} 様向け 注文請書` : selected ? "注文請書" : "注文請書";
  const heroSubtitle = [
    selected?.acknowledgment_number ? `注文書より発行` : "",
    periodStart && periodEnd ? `工期 ${periodStart}〜${periodEnd}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "注文請書" },
      ]}
      action={
        msg ? (
          <span style={{ fontSize: 12, color: msg.startsWith("エラー") || msg.startsWith("削除") ? "var(--c-danger)" : "var(--c-success)" }}>
            {msg}
          </span>
        ) : null
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : acks.length === 0 ? (
        /* 空状態 */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px", gap: 12, color: "var(--c-text-muted)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600 }}>注文請書がありません</p>
          <p style={{ fontSize: 12 }}>注文書のステータスを「発行済み」にすると自動発行されます</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>

          {/* ── 左: 一覧 ── */}
          <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid var(--c-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)" }}>
                {checkedIds.size > 0 ? `${checkedIds.size}件選択` : "一覧"}
              </span>
              {checkedIds.size > 0 && (
                <button onClick={handleDeleteSelected} disabled={deleting}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
                  <Trash2 size={12} />{deleting ? "削除中" : `削除(${checkedIds.size})`}
                </button>
              )}
            </div>
            {acks.map(a => {
              const sm = STATUS_META[a.status] || STATUS_META.draft;
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "stretch",
                  borderBottom: "1px solid var(--c-border)",
                  borderLeft: selected?.id === a.id ? "2px solid var(--c-primary)" : "2px solid transparent",
                  background: selected?.id === a.id ? "color-mix(in oklab,var(--c-primary) 8%,var(--c-surface))" : "none",
                }}>
                  <label style={{ display: "flex", alignItems: "center", padding: "0 4px 0 8px", cursor: "pointer" }}>
                    <input type="checkbox" checked={checkedIds.has(a.id)}
                      onChange={e => { const n = new Set(checkedIds); e.target.checked ? n.add(a.id) : n.delete(a.id); setCheckedIds(n); }}
                      onClick={ev => ev.stopPropagation()} />
                  </label>
                  <button onClick={() => selectAck(a)} style={{
                    flex: 1, textAlign: "left", padding: "8px 10px 8px 4px",
                    background: "none", border: "none", cursor: "pointer",
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--ff-mono)", color: "var(--c-text)" }}>{a.acknowledgment_number}</p>
                    <p style={{ fontSize: 10, color: "var(--c-text-muted)", marginTop: 1 }}>{a.issue_date || "日付未定"}</p>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
                      padding: "1px 7px", borderRadius: "var(--r-pill)", fontSize: 9, fontWeight: 600,
                      background: sm.bg, color: sm.text, border: `1px solid ${sm.border}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: sm.dot }} />
                      {sm.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── 右: 詳細 ── */}
          {selected && (
            <div>
              {/* ─ Hero ─ */}
              <div style={{
                background: "var(--c-surface)", border: "1px solid var(--c-border)",
                borderRadius: "var(--r-lg)", padding: "14px 18px",
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                gap: 16, alignItems: "center", marginBottom: 14,
              }}>
                <span style={{
                  fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 600,
                  color: "var(--c-text-muted)", background: "var(--c-surface-2)",
                  padding: "3px 9px", borderRadius: "var(--r-md)", whiteSpace: "nowrap",
                }}>
                  {selected.acknowledgment_number || "注文請書"}
                </span>
                <div>
                  <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {heroTitle}
                    {heroSubtitle && (
                      <small style={{ display: "block", fontWeight: 500, color: "var(--c-text-muted)", fontSize: 12, marginTop: 2 }}>
                        {heroSubtitle}
                      </small>
                    )}
                  </h1>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusBadge status={selected.status} onChange={handleStatusChange} />
                  <div style={{ width: 1, height: 24, background: "var(--c-border)" }} />
                  {/* PDF */}
                  <button
                    onClick={async () => {
                      setPdfLoading(true);
                      try {
                        const r = await fetch(`${API_URL}/api/v1/acknowledgments/${selected.id}/export-pdf`, {
                          headers: { Authorization: `Bearer ${getToken()}` },
                        });
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        const blob = await r.blob();
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `注文請書_${selected.acknowledgment_number || selected.id}.pdf`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      } catch (e) { alert(`PDFエラー: ${(e as Error).message}`); }
                      finally { setPdfLoading(false); }
                    }}
                    className="btn"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>
                    {pdfLoading ? "生成中…" : "PDF"}
                  </button>
                  {/* Excel */}
                  <button
                    onClick={() => fetch(`${API_URL}/api/v1/acknowledgments/${selected.id}/export`, {
                      headers: { Authorization: `Bearer ${getToken()}` },
                    }).then(r => r.blob()).then(blob => {
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `注文請書_${selected.acknowledgment_number || selected.id}.xlsx`;
                      a.click();
                    })}
                    className="btn"
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Download size={14} /> Excel
                  </button>
                  {/* 注文書から取込 */}
                  {!isIssued && (
                    <button onClick={handleImportFromOrder}
                      className="btn"
                      style={{ display: "flex", alignItems: "center", gap: 5, background: "color-mix(in oklab, var(--c-success) 12%, var(--c-surface))", color: "var(--c-success)", border: "1px solid color-mix(in oklab, var(--c-success) 30%, var(--c-border))" }}
                    >
                      📋 注文書から取込
                    </button>
                  )}
                  {/* 保存 */}
                  {!isIssued && (
                    <button onClick={handleSave} disabled={saving}
                      className="btn btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                  )}
                </div>
              </div>

              {/* ─ タイムライン ─ */}
              <Timeline status={selected.status} issueDate={selected.issue_date} />

              {/* ─ 2カラム本体 ─ */}
              <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: 12 }}>

                {/* 左カラム: 受注者・件名 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                  <div className="card">
                    <div className="card-head">
                      <div>
                        <div className="card-title">受注者・件名</div>
                        <div className="card-sub">{isIssued ? "発行済み（読み取り専用）" : "クリックで編集"}</div>
                      </div>
                    </div>
                    <div style={{
                      display: "grid", gridTemplateColumns: "100px 1fr 100px 1fr",
                      borderTop: "1px solid var(--c-border)",
                    }}>
                      <K>受注者</K>
                      <V value={clientCompany} onChange={!isIssued ? setClientCompany : undefined} span2 placeholder="株式会社○○" disabled={isIssued} />

                      <K>担当者</K>
                      <V value={clientPerson} onChange={!isIssued ? setClientPerson : undefined} placeholder="田中 一郎 課長" disabled={isIssued} />
                      <K>住所・TEL</K>
                      <V value={clientAddress} onChange={!isIssued ? setClientAddress : undefined} placeholder="福井県…" disabled={isIssued} />

                      <K>工事場所</K>
                      <V value={clientAddress} onChange={!isIssued ? setClientAddress : undefined} span2 disabled={isIssued} />

                      <K>工期</K>
                      <div style={{
                        padding: "9px 12px", fontSize: 12, fontFamily: "var(--ff-mono)",
                        borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)",
                        display: "flex", alignItems: "center", gap: 4,
                        background: isIssued ? "var(--c-surface-2)" : "var(--c-surface)",
                      }}>
                        <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                          disabled={isIssued}
                          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)", width: 110, cursor: isIssued ? "default" : "text" }} />
                        <span>〜</span>
                        <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                          disabled={isIssued}
                          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)", width: 110, cursor: isIssued ? "default" : "text" }} />
                      </div>
                      <K>発行日</K>
                      <div style={{
                        padding: "9px 12px", borderBottom: "1px solid var(--c-border)",
                        display: "flex", alignItems: "center",
                        background: isIssued ? "var(--c-surface-2)" : "var(--c-surface)",
                      }}>
                        <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                          disabled={isIssued}
                          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--ff-mono)" }} />
                      </div>

                      <K>支払条件</K>
                      <V value={paymentCondition} onChange={!isIssued ? setPaymentCondition : undefined} span2
                        placeholder="月末締・翌月末払（現金）" disabled={isIssued} />

                      <K noBorder>約款</K>
                      <div style={{
                        padding: "9px 12px",
                        gridColumn: "2 / span 3",
                        background: isIssued ? "var(--c-surface-2)" : "var(--c-surface)",
                      }}>
                        <textarea
                          value={terms} onChange={e => setTerms(e.target.value)}
                          rows={4} disabled={isIssued}
                          style={{
                            width: "100%", border: "none", outline: "none",
                            background: "transparent", fontSize: 12, lineHeight: 1.7,
                            resize: isIssued ? "none" : "vertical", color: "var(--c-text)",
                          }}
                          onFocus={e => { if (!isIssued) e.target.style.background = "color-mix(in oklab,var(--c-primary) 4%,var(--c-surface))"; }}
                          onBlur={e => { e.target.style.background = "transparent"; }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右カラム: 金額カード */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                  <div style={{
                    background: "var(--c-surface)", border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-lg)", overflow: "hidden",
                  }}>
                    {/* ヘッダー（purple） */}
                    <div style={{ background: "#7c3aed", color: "#fff", padding: "11px 14px" }}>
                      <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: "0.04em", fontWeight: 600 }}>
                        注文請書金額（税込）
                      </div>
                      <div style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                        {fmtYen(selected.total_amount)}
                      </div>
                    </div>
                    {/* 小計 */}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)" }}>
                      <span style={{ color: "var(--c-text-muted)", fontSize: 12 }}>小計（税抜）</span>
                      <span style={{ fontFamily: "var(--ff-mono)", fontWeight: 600 }}>{fmtYen(selected.amount_excl_tax)}</span>
                    </div>
                    {/* 消費税（major） */}
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--c-border)",
                      background: "var(--c-surface-2)", fontWeight: 700,
                    }}>
                      <span style={{ color: "var(--c-text)", fontWeight: 600, fontSize: 12 }}>消費税（10%）</span>
                      <span style={{ fontFamily: "var(--ff-mono)", fontSize: 15 }}>{fmtYen(selected.tax_amount)}</span>
                    </div>
                    {/* 印紙税 */}
                    {selected.stamp_tax != null && (
                      <div style={{
                        padding: 14, borderTop: "1px solid var(--c-border)",
                        background: "color-mix(in oklab,var(--c-warn) 6%,var(--c-surface))",
                      }}>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
                          印紙税額（自動算定）
                        </div>
                        <div style={{ fontFamily: "var(--ff-mono)", fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                          {fmtYen(selected.stamp_tax)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                          {stampTaxDesc(selected.total_amount)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 発行済みバナー */}
                  {isIssued && (
                    <div style={{
                      padding: "12px 14px", borderRadius: "var(--r-md)",
                      background: "color-mix(in oklab,#7c3aed 8%,var(--c-surface))",
                      border: "1.5px solid #7c3aed", fontSize: 12, color: "#7c3aed",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <Check size={14} /> 発行済みです
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
