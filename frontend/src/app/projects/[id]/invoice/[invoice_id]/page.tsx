"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Calculator, CheckCircle2, Download, Plus, Trash2, Unlink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtYen } from "@/lib/format";
import {
  BILLING_METHOD_LABEL,
  INVOICE_STATUS_LABEL,
  BillingMethod,
  InvoiceRead,
  InvoiceStatus,
  PaymentRead,
} from "@/types/invoice";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") || "" : ""; }

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
  sent: { background: "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))", color: "var(--c-primary)" },
  paid: { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))", color: "var(--c-success)" },
  partially_paid: { background: "color-mix(in oklab, #16a34a 10%, var(--c-surface))", color: "#16a34a" },
  overdue: { background: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))", color: "var(--c-danger)" },
  cancelled: { background: "color-mix(in oklab, var(--c-text-muted) 14%, var(--c-surface))", color: "var(--c-text-muted)" },
};

function LI({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const fmt = fmtYen;

/** 請求書詳細ページ（Phase F: 分割請求・入金記録対応）。 */
export default function InvoiceDetailPage() {
  const { id: projectId, invoice_id: invoiceId } = useParams<{ id: string; invoice_id: string }>();

  const [inv, setInv] = useState<InvoiceRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // header fields
  const [issueDate, setIssueDate] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [currentPurchase, setCurrentPurchase] = useState("");
  const [billingMethod, setBillingMethod] = useState<BillingMethod | "">("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [billingPercentage, setBillingPercentage] = useState("");
  const [billingNote, setBillingNote] = useState("");

  // 割合モーダル
  const [showPctModal, setShowPctModal] = useState(false);
  const [quoteSubtotal, setQuoteSubtotal] = useState<number | null>(null);
  const [modalPct, setModalPct] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // payment add form
  const [payAmt, setPayAmt] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payNote, setPayNote] = useState("");
  const [addingPayment, setAddingPayment] = useState(false);

  useEffect(() => { load(); }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<InvoiceRead>(`/api/v1/projects/${projectId}/invoices/${invoiceId}`);
      setInv(data);
      setIssueDate(data.issue_date || "");
      setPaymentDueDate(data.payment_due_date || "");
      setPrevBalance(data.previous_balance?.toString() || "");
      setReceivedAmount(data.received_amount?.toString() || "");
      setCurrentPurchase(data.current_purchase?.toString() || "");
      setBillingMethod(data.billing_method || "");
      setBillingPercentage(data.billing_percentage?.toString() || "");
      setBillingNote(data.billing_note || "");
    } catch {
      setMsg("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 3000); };

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          issue_date: issueDate || null,
          payment_due_date: paymentDueDate || null,
          previous_balance: prevBalance ? parseFloat(prevBalance) : null,
          received_amount: receivedAmount ? parseFloat(receivedAmount) : null,
          current_purchase: currentPurchase ? parseFloat(currentPurchase) : null,
          billing_method: billingMethod || null,
          billing_percentage: billingPercentage ? parseFloat(billingPercentage) : null,
          billing_note: billingNote || null,
        }),
      });
      showMsg("保存しました");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(s: InvoiceStatus) {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`, {
        method: "PATCH", body: JSON.stringify({ status: s }),
      });
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleUnlink() {
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}/unlink`, { method: "PATCH" });
      showMsg("見積連動を解除しました");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function handleAddPayment() {
    if (!payAmt || !payDate) return;
    setAddingPayment(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(payAmt),
          payment_date: payDate,
          payment_method: payMethod || null,
          note: payNote || null,
        }),
      });
      showMsg("入金を記録しました");
      setPayAmt(""); setPayDate(""); setPayMethod(""); setPayNote("");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setAddingPayment(false); }
  }

  async function handleDeletePayment(p: PaymentRead) {
    if (!confirm(`¥${Math.round(p.amount).toLocaleString()} の入金記録を削除しますか？`)) return;
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}/payments/${p.id}`, { method: "DELETE" });
      showMsg("入金記録を削除しました");
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
  }

  async function openPctModal() {
    setModalPct(billingPercentage);
    setShowPctModal(true);
    // 顧客見積の合計を取得
    try {
      const quotes = await apiFetch<{ id: string; subtotal: number | null; total_amount: number | null }[]>(
        `/api/v1/projects/${projectId}/quotes`
      );
      if (quotes.length > 0) {
        const q = quotes[0];
        setQuoteSubtotal(q.subtotal ?? q.total_amount ?? null);
      }
    } catch {
      setQuoteSubtotal(null);
    }
  }

  const [splitting, setSplitting] = useState(false);

  async function handleAutoSplit() {
    const pct = parseFloat(billingPercentage);
    if (isNaN(pct) || pct <= 0) { showMsg("割合(%)を入力してから自動分割してください"); return; }
    const n = Math.floor(100 / pct);
    const lastPct = 100 - (n - 1) * pct;
    const preview = Array.from({ length: n }, (_, i) => i < n - 1 ? `${pct}%` : `${lastPct}%`).join("・");
    if (!confirm(`${n}枚の請求書を自動作成します。\n${preview}\n\nよろしいですか？`)) return;
    setSplitting(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/invoices/${invoiceId}/auto-split`, { method: "POST" });
      showMsg(`${n}枚の請求書を作成しました`);
      await load();
    } catch (e) { showMsg(`エラー: ${(e as Error).message}`); }
    finally { setSplitting(false); }
  }

  function applyPctModal() {
    const pct = parseFloat(modalPct);
    if (!isNaN(pct) && quoteSubtotal !== null) {
      const calc = Math.floor(quoteSubtotal * pct / 100);
      setCurrentPurchase(calc.toString());
    }
    setBillingPercentage(modalPct);
    setShowPctModal(false);
  }

  const purchase = currentPurchase ? parseFloat(currentPurchase) : null;
  const tax = purchase !== null ? Math.floor(purchase * 0.10) : null;
  const total = purchase !== null && tax !== null ? purchase + tax : null;
  const outstanding = prevBalance && receivedAmount
    ? parseFloat(prevBalance) - parseFloat(receivedAmount)
    : null;
  const totalPaid = inv?.payments.reduce((s, p) => s + p.amount, 0) ?? 0;
  const isPaid = inv?.status === "paid";
  const isLinked = inv?.linked_to_quote && inv?.quote_id;

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "請求書一覧", href: `/projects/${projectId}/invoice` },
        { label: inv ? `${inv.invoice_number || "請求書"}${inv.split_sequence && inv.split_total ? ` （第${inv.split_sequence}回/全${inv.split_total}回）` : ""}` : "請求書詳細" },
      ]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {msg && (
            <span style={{ fontSize: 13, color: msg.startsWith("エラー") ? "var(--c-danger)" : "var(--c-success)" }}>
              {msg}
            </span>
          )}
          <Button
            variant="default" size="sm"
            onClick={() => {
              fetch(`${API_URL}/api/v1/projects/${projectId}/invoices/${invoiceId}/export`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              }).then(r => r.blob()).then(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `請求書_${inv?.invoice_number || invoiceId}.xlsx`;
                a.click();
              });
            }}
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button
            variant="default" size="sm"
            style={{ background: pdfLoading ? "#888" : "#C00000", color: "#fff" }}
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                const r = await fetch(`${API_URL}/api/v1/projects/${projectId}/invoices/${invoiceId}/export-pdf`, {
                  headers: { Authorization: `Bearer ${getToken()}` },
                });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const blob = await r.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `請求書_${inv?.invoice_number || invoiceId}.pdf`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              } catch (e) {
                alert(`PDF生成エラー: ${(e as Error).message}`);
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            <Download className="w-3.5 h-3.5" />
            {pdfLoading ? "生成中..." : "PDF"}
          </Button>
          {!isPaid && (
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}
              style={{ background: "var(--c-primary)", color: "#fff" }}>
              {saving ? "保存中…" : "保存"}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>読み込み中…</div>
      ) : !inv ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-danger)" }}>請求書が見つかりません</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 見積連動バナー */}
          {isLinked && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: "var(--r-md)",
              background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
              border: "1px solid color-mix(in oklab, var(--c-primary) 30%, var(--c-border))",
              fontSize: 13, color: "var(--c-primary)",
            }}>
              <span>この請求書は見積書と連動中（金額は自動同期）</span>
              <button
                onClick={handleUnlink}
                style={{
                  marginLeft: "auto", background: "none", border: "1px solid currentColor",
                  borderRadius: "var(--r-sm)", padding: "2px 8px", cursor: "pointer",
                  fontSize: 11, color: "var(--c-primary)", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Unlink className="w-3 h-3" /> 連動を解除
              </button>
            </div>
          )}

          {/* ステータス */}
          <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>ステータス</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"] as InvoiceStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  style={{
                    padding: "3px 10px", borderRadius: "var(--r-pill)",
                    border: "1px solid var(--c-border)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    ...(inv.status === s ? (STATUS_STYLE[s] || STATUS_STYLE.draft) : { background: "var(--c-surface-2)", color: "var(--c-text-muted)" }),
                  }}
                >
                  {INVOICE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* ヘッダ情報 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>基本情報</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LI label="発行日">
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} disabled={isPaid} />
              </LI>
              <LI label="支払期日">
                <Input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} disabled={isPaid} />
              </LI>
            </div>
          </div>

          {/* 分割請求設定 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>請求方法</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <LI label="請求方法">
                <select
                  value={billingMethod}
                  onChange={e => setBillingMethod(e.target.value as BillingMethod | "")}
                  disabled={isPaid}
                  style={{
                    width: "100%", padding: "6px 8px", fontSize: 13,
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                    background: "var(--c-surface)",
                  }}
                >
                  <option value="">— 選択 —</option>
                  {(Object.keys(BILLING_METHOD_LABEL) as BillingMethod[]).map(m => (
                    <option key={m} value={m}>{BILLING_METHOD_LABEL[m]}</option>
                  ))}
                </select>
              </LI>
              {billingMethod === "percentage" && (
                <LI label="割合 (%)">
                  <div style={{ display: "flex", gap: 6 }}>
                    <Input
                      type="number" min="0" max="100" step="0.01"
                      value={billingPercentage}
                      onChange={e => setBillingPercentage(e.target.value)}
                      disabled={isPaid}
                      style={{ flex: 1 }}
                    />
                    {!isPaid && (
                      <button
                        onClick={openPctModal}
                        title="割合から請求額を計算"
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                          fontSize: 12, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                          background: "var(--c-surface-2)", color: "var(--c-primary)", cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Calculator size={13} /> 計算
                      </button>
                    )}
                  </div>
                  {!isPaid && !inv?.split_total && billingPercentage && (
                    <button
                      onClick={handleAutoSplit}
                      disabled={splitting}
                      style={{
                        marginTop: 6, display: "flex", alignItems: "center", gap: 4,
                        padding: "5px 12px", fontSize: 12, cursor: "pointer",
                        border: "1px solid var(--c-primary)", borderRadius: "var(--r-md)",
                        background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
                        color: "var(--c-primary)", whiteSpace: "nowrap",
                      }}
                    >
                      {splitting ? "作成中…" : `残り請求書を自動作成 (${Math.floor(100 / parseFloat(billingPercentage || "1"))}枚に分割)`}
                    </button>
                  )}
                  {inv?.split_sequence && inv?.split_total && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--c-success)", fontWeight: 600 }}>
                      ✓ 第{inv.split_sequence}回 / 全{inv.split_total}回
                    </div>
                  )}
                </LI>
              )}
              <LI label="備考">
                <Input value={billingNote} onChange={e => setBillingNote(e.target.value)} disabled={isPaid} placeholder="分割理由・内訳メモ等" />
              </LI>
            </div>
          </div>

          {/* 割合計算モーダル */}
          {showPctModal && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onClick={e => { if (e.target === e.currentTarget) setShowPctModal(false); }}
            >
              <div ref={modalRef} style={{
                background: "var(--c-surface)", borderRadius: "var(--r-lg)",
                padding: "24px 28px", width: 380, boxShadow: "var(--shadow-xl)",
                display: "flex", flexDirection: "column", gap: 16,
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>割合から請求額を計算</h3>
                <div style={{ fontSize: 12, color: "var(--c-text-muted)", lineHeight: 1.6 }}>
                  顧客見積の合計金額に対する割合（%）を指定すると、
                  今月御請求額（税抜）を自動計算します。
                </div>
                {quoteSubtotal !== null && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--r-md)",
                    background: "var(--c-surface-2)", fontSize: 13,
                  }}>
                    <span style={{ color: "var(--c-text-muted)" }}>顧客見積合計（税抜）：</span>
                    <span style={{ fontWeight: 700, fontFamily: "var(--ff-mono)", marginLeft: 8 }}>
                      {fmt(quoteSubtotal)}
                    </span>
                  </div>
                )}
                {quoteSubtotal === null && (
                  <div style={{ fontSize: 12, color: "var(--c-text-muted)", padding: "8px 0" }}>
                    顧客見積が登録されていません。割合を入力すると「今月御請求額」欄に自動入力されます。
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, color: "var(--c-text-muted)", display: "block", marginBottom: 4 }}>
                    請求割合 (%)
                  </label>
                  <Input
                    type="number" min="0" max="100" step="0.01"
                    value={modalPct}
                    onChange={e => setModalPct(e.target.value)}
                    placeholder="例: 50"
                    autoFocus
                  />
                </div>
                {quoteSubtotal !== null && modalPct && !isNaN(parseFloat(modalPct)) && (
                  <div style={{
                    padding: "10px 14px", borderRadius: "var(--r-md)",
                    background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
                    border: "1px solid color-mix(in oklab, var(--c-primary) 25%, transparent)",
                    fontSize: 13,
                  }}>
                    <span style={{ color: "var(--c-text-muted)" }}>計算結果（税抜）：</span>
                    <span style={{ fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-primary)", marginLeft: 8 }}>
                      {fmt(Math.floor(quoteSubtotal * parseFloat(modalPct) / 100))}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="default" size="sm" onClick={() => setShowPctModal(false)}
                    style={{ background: "var(--c-surface-2)", color: "var(--c-text)" }}>
                    キャンセル
                  </Button>
                  <Button variant="default" size="sm" onClick={applyPctModal}
                    style={{ background: "var(--c-primary)", color: "#fff" }}
                    disabled={!modalPct || isNaN(parseFloat(modalPct))}>
                    適用
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 金額 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>金額</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <LI label="前月御請求額（円）">
                <Input type="number" value={prevBalance} onChange={e => setPrevBalance(e.target.value)} disabled={isPaid} />
              </LI>
              <LI label="御入金額（円）">
                <Input type="number" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} disabled={isPaid} />
              </LI>
              <LI label="今月御請求額（税抜・円）">
                <Input type="number" value={currentPurchase} onChange={e => setCurrentPurchase(e.target.value)} disabled={isPaid} />
              </LI>
            </div>
            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 12 }}>
              {outstanding !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
                  <span>差引残高</span>
                  <span className="num">{fmt(outstanding)}</span>
                </div>
              )}
              {tax !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-text-muted)", marginBottom: 4 }}>
                  <span>消費税 (10%)</span>
                  <span className="num">{fmt(tax)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                <span>合計（税込）</span>
                <span className="num">{fmt(total ?? inv.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* 入金記録 */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>入金記録</h2>

            {inv.payments.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--c-text-muted)", marginBottom: 12 }}>入金記録がありません</p>
            ) : (
              <table className="tbl" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>入金日</th>
                    <th className="num">入金額</th>
                    <th>方法</th>
                    <th>備考</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize: 12 }}>{p.payment_date}</td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 600 }}>
                        {fmt(p.amount)}
                      </td>
                      <td style={{ fontSize: 12 }}>{p.payment_method || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{p.note || ""}</td>
                      <td>
                        <button
                          onClick={() => handleDeletePayment(p)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", display: "flex", padding: 4 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={1} style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)" }}>合計入金額</td>
                    <td className="num" style={{ padding: "6px 8px", fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 700 }}>
                      {fmt(totalPaid)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 入金追加フォーム */}
            {!isPaid && (
              <div style={{ background: "var(--c-surface-2)", borderRadius: "var(--r-md)", padding: "12px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>入金を追加</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <LI label="入金日 *">
                    <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                  </LI>
                  <LI label="金額（円）*">
                    <Input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0" />
                  </LI>
                  <LI label="方法">
                    <Input value={payMethod} onChange={e => setPayMethod(e.target.value)} placeholder="振込・現金 等" />
                  </LI>
                  <LI label="備考">
                    <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="任意" />
                  </LI>
                  <Button
                    variant="default" size="sm"
                    onClick={handleAddPayment}
                    disabled={addingPayment || !payAmt || !payDate}
                    style={{ background: "var(--c-primary)", color: "#fff", whiteSpace: "nowrap" }}
                  >
                    <Plus size={13} /> {addingPayment ? "登録中…" : "登録"}
                  </Button>
                </div>
              </div>
            )}

            {isPaid && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: "var(--r-md)",
                background: "color-mix(in oklab, var(--c-success) 10%, var(--c-surface))",
                border: "1px solid color-mix(in oklab, var(--c-success) 30%, var(--c-border))",
                fontSize: 13, color: "var(--c-success)",
              }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                入金完了
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
