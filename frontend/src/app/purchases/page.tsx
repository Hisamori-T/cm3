"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────

type OrderStatus = "draft" | "issued" | "partial_delivered" | "delivered" | "completed";

interface PurchaseOrder {
  id: string;
  project_id: string;
  project_name: string | null;
  project_number: string | null;
  vendor_id: string;
  vendor_name: string | null;
  order_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  total_amount: number;
  status: OrderStatus;
  issued_at: string | null;
}

// ── Constants ─────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft:             "下書き",
  issued:            "発行済",
  partial_delivered: "一部納品",
  delivered:         "納品完了",
  completed:         "完了",
};

const STATUS_COLOR: Record<OrderStatus, { bg: string; fg: string }> = {
  draft:             { bg: "#f1f5f9", fg: "#64748b" },
  issued:            { bg: "#dbeafe", fg: "#1d4ed8" },
  partial_delivered: { bg: "#fef3c7", fg: "#b45309" },
  delivered:         { bg: "#dcfce7", fg: "#15803d" },
  completed:         { bg: "#f0fdf4", fg: "#166534" },
};

const STATUS_ORDER: OrderStatus[] = ["draft", "issued", "partial_delivered", "delivered", "completed"];

function fmtYen(v: number | null | undefined): string {
  if (v == null) return "—";
  return `¥${Math.round(v).toLocaleString()}`;
}

// ── Main ──────────────────────────────────────────────────────

export default function PurchasesPage() {
  const [orders, setOrders]   = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status_filter=${statusFilter}` : "";
      const data = await apiFetch<PurchaseOrder[]>(`/api/v1/purchase-orders/all${params}`);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // サマリー集計
  const summary = STATUS_ORDER.reduce((acc, s) => {
    const group = orders.filter((o) => o.status === s);
    acc[s] = { count: group.length, total: group.reduce((sum, o) => sum + (o.total_amount ?? 0), 0) };
    return acc;
  }, {} as Record<OrderStatus, { count: number; total: number }>);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.project_name?.toLowerCase().includes(q)) ||
      (o.project_number?.toLowerCase().includes(q)) ||
      (o.vendor_name?.toLowerCase().includes(q)) ||
      (o.order_number?.toLowerCase().includes(q))
    );
  });

  const grandTotal = filtered.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  return (
    <AppShell breadcrumbs={[{ label: "発注管理" }]}>
      <div style={{ padding: "var(--sp-4)" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)", margin: 0 }}>発注管理（全案件）</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="案件名・業者名・発注番号で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", fontSize: 13, background: "var(--c-surface)", color: "var(--c-text)", width: 240 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
              style={{ padding: "6px 10px", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", fontSize: 13, background: "var(--c-surface)", color: "var(--c-text)" }}
            >
              <option value="">すべてのステータス</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* サマリーカード */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
          {STATUS_ORDER.map((s) => (
            <div
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              style={{
                padding: "10px 12px", borderRadius: "var(--r-lg)",
                border: `1px solid ${statusFilter === s ? STATUS_COLOR[s].fg : "var(--c-border)"}`,
                background: statusFilter === s ? STATUS_COLOR[s].bg : "var(--c-surface)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>{STATUS_LABEL[s]}</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: statusFilter === s ? STATUS_COLOR[s].fg : "var(--c-text)" }}>
                {summary[s]?.count ?? 0}
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>件</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "var(--ff-mono)" }}>
                {summary[s]?.total ? fmtYen(summary[s].total) : "—"}
              </div>
            </div>
          ))}
        </div>

        {/* テーブル */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--c-text-muted)" }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--c-text-muted)", border: "2px dashed var(--c-border)", borderRadius: "var(--r-lg)" }}>
            発注書がありません
          </div>
        ) : (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)" }}>
                    {["案件", "業者", "発注番号", "発注日", "納品期日", "金額", "ステータス", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const sc = STATUS_COLOR[o.status];
                    const overdue = o.delivery_date && o.delivery_date < new Date().toISOString().slice(0, 10) && o.status !== "delivered" && o.status !== "completed";
                    return (
                      <tr key={o.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <Link href={`/projects/${o.project_id}`} style={{ color: "var(--c-primary)", textDecoration: "none", fontWeight: 600, fontSize: 12 }}>
                            {o.project_number}
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 1 }}>{o.project_name ?? "—"}</div>
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--c-text)" }}>{o.vendor_name ?? "—"}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-text-muted)" }}>{o.order_number ?? "—"}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontSize: 12 }}>{o.order_date ?? "—"}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontSize: 12, color: overdue ? "var(--c-danger)" : "var(--c-text)", fontWeight: overdue ? 700 : 400 }}>
                          {o.delivery_date ?? "—"}
                          {overdue && <span style={{ marginLeft: 4, fontSize: 10, background: "var(--c-danger)", color: "#fff", borderRadius: 3, padding: "0 4px" }}>期限超過</span>}
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontWeight: 600, textAlign: "right" }}>{fmtYen(o.total_amount)}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.fg }}>
                            {STATUS_LABEL[o.status]}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <Link href={`/projects/${o.project_id}/purchase`} style={{ color: "var(--c-primary)", fontSize: 12, textDecoration: "none" }}>
                            詳細 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--c-border)", background: "var(--c-surface-2)" }}>
                    <td colSpan={5} style={{ padding: "8px 12px", fontSize: 12, color: "var(--c-text-muted)" }}>
                      {filtered.length}件
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--ff-mono)", fontWeight: 700, textAlign: "right" }}>
                      {fmtYen(grandTotal)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
