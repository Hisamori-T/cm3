"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { fmtYen } from "@/lib/format";
import {
  BILLING_METHOD_LABEL,
  INVOICE_STATUS_LABEL,
  BillingMethod,
  InvoiceRead,
  InvoiceSummary,
} from "@/types/invoice";

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  draft: { background: "var(--c-surface-2)", color: "var(--c-text-muted)" },
  sent: { background: "color-mix(in oklab, var(--c-primary) 14%, var(--c-surface))", color: "var(--c-primary)" },
  paid: { background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))", color: "var(--c-success)" },
  partially_paid: { background: "color-mix(in oklab, #16a34a 10%, var(--c-surface))", color: "#16a34a" },
  overdue: { background: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))", color: "var(--c-danger)" },
  cancelled: { background: "color-mix(in oklab, var(--c-text-muted) 14%, var(--c-surface))", color: "var(--c-text-muted)" },
};

const fmt = fmtYen;

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ja-JP") : "—";

function billingMethodLabel(inv: InvoiceRead): string {
  if (!inv.billing_method) return "—";
  if (inv.billing_method === "percentage") return `割合 ${inv.billing_percentage ?? ""}%`;
  return BILLING_METHOD_LABEL[inv.billing_method as BillingMethod] ?? inv.billing_method;
}

/** 請求書一覧ページ。案件請求サマリ＋請求書リスト＋選択削除。 */
export default function InvoiceListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();

  const [invoices, setInvoices] = useState<InvoiceRead[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { loadAll(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    setSelected(new Set());
    try {
      const [data, sum] = await Promise.all([
        apiFetch<InvoiceRead[]>(`/api/v1/projects/${projectId}/invoices`),
        apiFetch<InvoiceSummary>(`/api/v1/projects/${projectId}/invoice-summary`),
      ]);
      setInvoices(data);
      setSummary(sum);
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await apiFetch<InvoiceRead>(`/api/v1/projects/${projectId}/invoices`, {
        method: "POST", body: JSON.stringify({ items: [] }),
      });
      router.push(`/projects/${projectId}/invoice/${created.id}`);
    } catch (e) {
      setError(`作成に失敗しました: ${(e as Error).message}`);
      setCreating(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const deletable = invoices.filter(i => i.status !== "paid").map(i => i.id);
    if (deletable.every(id => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deletable));
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`選択した ${selected.size} 件の請求書を削除しますか？\n（入金済みは削除されません）`)) return;
    setDeleting(true);
    let failCount = 0;
    for (const id of selected) {
      try {
        await apiFetch(`/api/v1/projects/${projectId}/invoices/${id}`, { method: "DELETE" });
      } catch {
        failCount++;
      }
    }
    if (failCount > 0) setError(`${failCount} 件の削除に失敗しました`);
    await loadAll();
    setDeleting(false);
  }

  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const deletableSelected = [...selected].filter(id => {
    const inv = invoices.find(i => i.id === id);
    return inv && inv.status !== "paid";
  });

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: "案件詳細", href: `/projects/${projectId}` },
        { label: "請求書" },
      ]}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selected.size > 0 && (
            <Button
              variant="default" size="sm"
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{ background: "var(--c-danger)", color: "#fff" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "削除中…" : `${deletableSelected.length}件を削除`}
            </Button>
          )}
          <Button
            variant="default" size="sm"
            onClick={handleCreate}
            disabled={creating}
            style={{ background: "var(--c-primary)", color: "#fff" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? "作成中…" : "新規請求書を作成"}
          </Button>
        </div>
      }
    >
      <div className="toolbar">
        <h1>請求書</h1>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--r-md)", fontSize: 13,
          background: "var(--c-danger-bg)", color: "var(--c-danger)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, transparent)",
        }}>
          {error}
        </div>
      )}

      {/* 請求サマリバー */}
      {summary && summary.invoice_count > 0 && (
        <div className="card" style={{
          padding: "12px 20px", marginBottom: 12,
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>請求合計</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--ff-mono)" }}>
              {fmt(summary.total_billed)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>入金済み</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--ff-mono)", color: "var(--c-success)" }}>
              {fmt(summary.total_paid)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>未回収残高</div>
            <div style={{
              fontSize: 16, fontWeight: 700, fontFamily: "var(--ff-mono)",
              color: summary.outstanding > 0 ? "var(--c-danger)" : "var(--c-success)",
            }}>
              {fmt(summary.outstanding)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>最終支払期日</div>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: overdueCount > 0 ? "var(--c-danger)" : "var(--c-text)",
            }}>
              {fmtDate(summary.latest_due_date)}
              {overdueCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--c-danger)" }}>
                  ({overdueCount}件遅延)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--c-text-muted)" }}>
          読み込み中…
        </div>
      ) : invoices.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "80px 20px", gap: 12, color: "var(--c-text-muted)",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600 }}>請求書がありません</p>
          <p style={{ fontSize: 12 }}>「新規請求書を作成」ボタンで最初の請求書を作成してください</p>
          <Button
            variant="default" size="sm"
            onClick={handleCreate}
            disabled={creating}
            style={{ background: "var(--c-primary)", color: "#fff", marginTop: 8 }}
          >
            <Plus className="w-3.5 h-3.5" /> 新規請求書を作成
          </Button>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {selected.size > 0 && (
            <div style={{
              padding: "8px 16px", background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))",
              borderBottom: "1px solid var(--c-border)", fontSize: 13, color: "var(--c-primary)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span>{selected.size} 件選択中</span>
              <button
                onClick={() => setSelected(new Set())}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--c-text-muted)" }}
              >
                解除
              </button>
            </div>
          )}
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={invoices.filter(i => i.status !== "paid").length > 0 &&
                      invoices.filter(i => i.status !== "paid").every(i => selected.has(i.id))}
                    onChange={toggleAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th>請求番号</th>
                <th>発行日</th>
                <th>支払期日</th>
                <th className="num">請求金額（税込）</th>
                <th className="num">入金済み</th>
                <th className="num">未回収</th>
                <th>請求方法</th>
                <th>ステータス</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {(() => {
                // total 請求書と子（split）を整理して表示
                const topLevel = invoices.filter(i => i.invoice_type !== "split");
                const splitByParent: Record<string, InvoiceRead[]> = {};
                invoices.filter(i => i.invoice_type === "split" && i.parent_invoice_id).forEach(c => {
                  const pid = c.parent_invoice_id!;
                  splitByParent[pid] = [...(splitByParent[pid] ?? []), c];
                });

                const renderRow = (inv: InvoiceRead, isChild = false) => {
                  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                  const remaining = (inv.total_amount ?? 0) - paid;
                  const isPaid = inv.status === "paid";
                  const isTotal = inv.invoice_type === "total";
                  const hasChildren = isTotal && (splitByParent[inv.id]?.length ?? 0) > 0;
                  const isOpen = expanded.has(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      style={{
                        background: isChild
                          ? "color-mix(in oklab, var(--c-primary) 3%, var(--c-surface))"
                          : selected.has(inv.id) ? "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))" : undefined,
                      }}
                    >
                      <td style={{ textAlign: "center" }}>
                        {!isChild && (
                          <input type="checkbox" checked={selected.has(inv.id)}
                            onChange={() => toggleSelect(inv.id)} disabled={isPaid}
                            style={{ cursor: isPaid ? "not-allowed" : "pointer", opacity: isPaid ? 0.3 : 1 }}
                          />
                        )}
                      </td>
                      <td style={{ fontWeight: 600, paddingLeft: isChild ? 28 : undefined }}>
                        {hasChildren && (
                          <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(inv.id) ? n.delete(inv.id) : n.add(inv.id); return n; })}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px 0 0", color: "var(--c-text-muted)" }}>
                            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        )}
                        <Link href={`/projects/${projectId}/invoice/${inv.id}`}
                          style={{ color: isTotal ? "var(--c-primary)" : "var(--c-text)", textDecoration: "none", fontSize: isChild ? 12 : undefined }}>
                          {inv.invoice_number || "（番号なし）"}
                          {isTotal && <span style={{ marginLeft: 4, fontSize: 10, background: "var(--c-primary)", color: "#fff", borderRadius: 4, padding: "1px 5px" }}>総額</span>}
                          {isChild && inv.split_sequence && inv.split_total && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: "var(--c-text-muted)" }}>
                              第{inv.split_sequence}回/全{inv.split_total}回
                            </span>
                          )}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(inv.issue_date)}</td>
                      <td style={{ fontSize: 12, color: inv.status === "overdue" ? "var(--c-danger)" : undefined }}>
                        {fmtDate(inv.payment_due_date)}
                      </td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: isChild ? 12 : 13, fontWeight: 600 }}>
                        {isTotal ? <span style={{ color: "var(--c-text-muted)" }}>{fmt(inv.total_amount)}</span> : fmt(inv.total_amount)}
                      </td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-success)" }}>
                        {isChild ? "—" : paid > 0 ? fmt(paid) : "—"}
                      </td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: remaining > 0 ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                        {isChild ? "—" : inv.total_amount ? fmt(remaining) : "—"}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{billingMethodLabel(inv)}</td>
                      <td>
                        <span style={{ display: "inline-flex", padding: "1px 8px", borderRadius: "var(--r-pill)", fontSize: 11, fontWeight: 600, ...(STATUS_STYLE[inv.status] || STATUS_STYLE.draft) }}>
                          {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td>
                        <Link href={`/projects/${projectId}/invoice/${inv.id}`}>
                          <Button variant="default" size="sm">開く</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                };

                return topLevel.flatMap(inv => {
                  const rows = [renderRow(inv)];
                  if (inv.invoice_type === "total" && expanded.has(inv.id)) {
                    (splitByParent[inv.id] ?? []).sort((a, b) => (a.split_sequence ?? 0) - (b.split_sequence ?? 0))
                      .forEach(child => rows.push(renderRow(child, true)));
                  }
                  return rows;
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
