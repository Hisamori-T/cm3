"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import type { ProjectListItem } from "@/types/project";

interface KpiCard { label: string; value: number; unit: string; }
interface StatusCount { status: string; label: string; count: number; }
interface MonthlyStat { month: string; invoice_total: number; project_count: number; }
interface DeadlineAlert {
  project_id: string; project_number: string; project_name: string;
  deadline: string; days_left: number; alert_type: string;
}
interface RecentActivity {
  entity_type: string; change_type: string;
  project_id: string | null; changed_by_name: string; changed_at: string;
}
interface UnpaidAlert {
  project_id: string; project_number: string; project_name: string;
  invoice_id: string; invoice_number: string | null;
  total_amount: number; payment_due_date: string | null;
  days_overdue: number; status: string;
}
interface InvoiceStats {
  this_month_billed: number;
  total_pending: number;
  total_overdue: number;
  overdue_count: number;
}
interface UserWorkHours {
  user_id: string;
  user_name: string;
  this_month_minutes: number;
}
interface PeriodAlertItem {
  alert_type: string;
  project_id: string; project_number: string; project_name: string; client_name: string;
  invoice_id?: string; invoice_number?: string;
  days: number; detail: string;
}
interface InvoiceListItem {
  invoice_id: string; invoice_number: string | null;
  project_id: string; project_name: string; client_name: string;
  total_amount: number; total_paid: number; status: string; issue_date: string | null;
}
interface MonthlyInvoiceGroup {
  year_month: string; display: string;
  total_billed: number; total_paid: number;
  invoices: InvoiceListItem[];
}
interface DashboardData {
  kpi: KpiCard[]; status_distribution: StatusCount[];
  monthly_stats: MonthlyStat[]; deadline_alerts: DeadlineAlert[];
  recent_activities: RecentActivity[];
  invoice_stats: InvoiceStats;
  unpaid_alerts: UnpaidAlert[];
  user_work_hours: UserWorkHours[];
  period_alerts: PeriodAlertItem[];
  monthly_invoices: MonthlyInvoiceGroup[];
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  payment_due_soon: { label: "支払期日近迫", icon: "⏰", color: "#f59e0b" },
  payment_overdue:  { label: "支払期日超過", icon: "⚠️", color: "#ef4444" },
  invoice_not_issued: { label: "請求書未発行", icon: "📄", color: "#8b5cf6" },
  schedule_overrun: { label: "工期超過", icon: "🏗️", color: "#f97316" },
  invoice_long_unpaid: { label: "入金未確認", icon: "💴", color: "#6366f1" },
};

const STATUS_COLOR: Record<string, string> = {
  quote: "var(--c-status-quote)", ordered: "var(--c-status-order)",
  started: "var(--c-status-start)", in_progress: "var(--c-status-progress)",
  completed: "var(--c-status-done)", billed: "var(--c-status-billed)", paid: "var(--c-status-paid)",
};
const ENTITY_LABEL: Record<string, string> = {
  project: "案件", quote: "見積書", order: "注文書", invoice: "請求書", qcds: "QCDS",
};
const CHANGE_LABEL: Record<string, string> = {
  created: "作成", updated: "更新", deleted: "削除", status_changed: "ステータス変更",
};

function fmtMoney(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`;
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万`;
  return v.toLocaleString();
}

function fmtRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 統合期限アラートカード */
function PeriodAlertsCard({ alerts }: { alerts: PeriodAlertItem[] }) {
  const byType: Record<string, PeriodAlertItem[]> = {};
  for (const a of alerts) {
    byType[a.alert_type] = [...(byType[a.alert_type] ?? []), a];
  }
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            ⚠️ 期限アラート
          </div>
          <div className="card-sub">対応が必要な案件 · 計{alerts.length}件</div>
        </div>
      </div>
      {Object.entries(ALERT_TYPE_CONFIG).map(([type, cfg]) => {
        const items = byType[type] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={type}>
            <div style={{
              padding: "6px 14px", background: `${cfg.color}18`,
              borderLeft: `3px solid ${cfg.color}`, fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, color: cfg.color,
            }}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span style={{ marginLeft: "auto", background: cfg.color, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>
                {items.length}件
              </span>
            </div>
            {items.slice(0, 3).map((a, i) => (
              <Link
                key={i}
                href={a.invoice_id ? `/projects/${a.project_id}/invoice/${a.invoice_id}` : `/projects/${a.project_id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px 8px 24px", borderBottom: "1px solid var(--c-border)", textDecoration: "none", fontSize: 12 }}
              >
                <div>
                  <span style={{ fontWeight: 500, color: "var(--c-text)" }}>{a.project_name}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--c-text-muted)" }}>{a.client_name}</span>
                </div>
                <span style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: cfg.color, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 12 }}>
                  {a.detail}
                </span>
              </Link>
            ))}
            {items.length > 3 && (
              <div style={{ padding: "4px 24px", fontSize: 11, color: "var(--c-text-muted)" }}>他{items.length - 3}件…</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 請求書年月別一覧カード */
function MonthlyInvoicesCard({ groups }: { groups: MonthlyInvoiceGroup[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set([groups[0]?.year_month ?? ""]));
  const toggle = (ym: string) => setOpen(prev => {
    const next = new Set(prev);
    next.has(ym) ? next.delete(ym) : next.add(ym);
    return next;
  });
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">請求書一覧（月別）</div>
          <div className="card-sub">入金待ち請求書 · クリックで折りたたみ</div>
        </div>
      </div>
      {groups.map(g => (
        <div key={g.year_month}>
          <button
            onClick={() => toggle(g.year_month)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", border: "none", background: "var(--c-surface-2)", borderTop: "1px solid var(--c-border)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            <span>{open.has(g.year_month) ? "▼" : "▶"} {g.display}</span>
            <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-text-muted)", fontWeight: 400 }}>
              請求{fmtMoney(g.total_billed)}円 / 入金{fmtMoney(g.total_paid)}円
            </span>
          </button>
          {open.has(g.year_month) && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--c-border)", color: "var(--c-text-muted)", fontSize: 11 }}>
                  <th style={{ padding: "4px 14px", textAlign: "left", fontWeight: 500 }}>工事名</th>
                  <th style={{ padding: "4px 10px", textAlign: "left", fontWeight: 500 }}>発注者</th>
                  <th style={{ padding: "4px 10px", textAlign: "right", fontWeight: 500 }}>総額</th>
                  <th style={{ padding: "4px 14px", textAlign: "right", fontWeight: 500 }}>入金済</th>
                </tr>
              </thead>
              <tbody>
                {g.invoices.map(inv => (
                  <tr key={inv.invoice_id} style={{ borderBottom: "1px solid var(--c-border)", cursor: "pointer" }}
                    onClick={() => window.location.href = `/projects/${inv.project_id}/invoice/${inv.invoice_id}`}>
                    <td style={{ padding: "6px 14px" }}>
                      <div style={{ fontWeight: 500 }}>{inv.project_name}</div>
                      <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{inv.invoice_number}</div>
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--c-text-muted)" }}>{inv.client_name || "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--ff-mono)", fontWeight: 600 }}>
                      ¥{Math.round(inv.total_amount).toLocaleString()}
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "right", fontFamily: "var(--ff-mono)", color: inv.total_paid >= inv.total_amount ? "var(--c-success)" : "var(--c-danger)" }}>
                      ¥{Math.round(inv.total_paid).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

/** ステータス別ドーナツ SVG */
function DonutChart({ data, total }: { data: StatusCount[]; total: number }) {
  let off = 25;
  const segs = data.map(s => {
    const pct = total > 0 ? (s.count / total) * 100 : 0;
    const r = { ...s, pct, off };
    off -= pct;
    return r;
  });
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--c-surface-2)" strokeWidth="6" />
        {segs.map(s => s.pct > 0 && (
          <circle key={s.status} cx="21" cy="21" r="15.9155" fill="transparent"
            stroke={STATUS_COLOR[s.status] ?? "var(--c-border)"}
            strokeWidth="6"
            strokeDasharray={`${s.pct} ${100 - s.pct}`}
            strokeDashoffset={s.off}
          />
        ))}
        <text x="21" y="20.5" textAnchor="middle" className="donut-center">{total}</text>
        <text x="21" y="25" textAnchor="middle" fontSize="3" fill="var(--c-text-muted)">件</text>
      </svg>
      <div className="donut-legend">
        {segs.map(s => (
          <div key={s.status} className="row">
            <span className="sw" style={{ background: STATUS_COLOR[s.status] ?? "var(--c-border)" }} />
            <span className="nm">{s.label}</span>
            <span className="ct">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 月別請求額 SVG バーチャート */
function BarChart({ data }: { data: MonthlyStat[] }) {
  const maxVal = Math.max(...data.map(d => d.invoice_total), 1);
  const maxAxis = Math.ceil(maxVal / 100000) * 100000 || 1;
  const CH = 160; // chart height (y=20..180)
  const BW = 30, BS = 55, SX = 50;

  const yTick = (i: number) => 180 - (i / 4) * CH;
  const bH = (v: number) => (v / maxAxis) * CH;
  const bY = (v: number) => 180 - bH(v);
  const yLbl = (i: number) => {
    const v = (maxAxis / 4) * i;
    return v >= 10000 ? `${v / 10000}万` : String(Math.round(v));
  };

  return (
    <div className="bar-chart">
      <svg className="bar-svg" viewBox="0 0 720 200" preserveAspectRatio="none">
        <g stroke="var(--c-border)" strokeDasharray="2 3" strokeWidth="0.5">
          {[0, 1, 2, 3, 4].map(i => <line key={i} x1="40" y1={yTick(i)} x2="710" y2={yTick(i)} />)}
        </g>
        <g fontSize="9" fill="var(--c-text-subtle)" fontFamily="var(--ff-mono)">
          {[0, 1, 2, 3, 4].map(i => (
            <text key={i} x="35" y={yTick(i) + 2} textAnchor="end">{yLbl(i)}</text>
          ))}
        </g>
        <g fill="var(--c-primary)" opacity="0.92">
          {data.map((d, i) => {
            const h = bH(d.invoice_total);
            return h > 0 ? (
              <rect key={i} x={SX + i * BS} y={bY(d.invoice_total)} width={BW} height={h} />
            ) : (
              <rect key={i} x={SX + i * BS} y={179} width={BW} height={1} fill="var(--c-border)" />
            );
          })}
        </g>
        <g fontSize="9" fill="var(--c-text-subtle)" fontFamily="var(--ff-mono)" textAnchor="middle">
          {data.map((d, i) => (
            <text key={i} x={SX + i * BS + BW / 2} y="194">
              {parseInt(d.month.slice(5))}月
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** ダッシュボード (S02) */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const d = await apiFetch<DashboardData>("/api/v1/dashboard");
      setData(d);
    } catch { /* 401 → /login redirect by apiFetch */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = data?.kpi[0]?.value ?? 0;
  const overdue = data?.deadline_alerts.filter(a => a.days_left <= 0).length ?? 0;
  const soon7   = data?.deadline_alerts.filter(a => a.days_left > 0 && a.days_left <= 7).length ?? 0;
  const soon30  = data?.deadline_alerts.filter(a => a.days_left > 7).length ?? 0;

  return (
    <AppShell
      breadcrumbs={[{ label: "ダッシュボード" }]}
      action={
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新規案件
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="toolbar">
        <h1>ダッシュボード</h1>
        <span className="meta">通期サマリ</span>
        <span style={{ flex: 1 }} />
        <div className="seg">
          <button className="on">全社</button>
          <button>自分担当</button>
        </div>
      </div>

      {isLoading || !data ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>
          読み込み中...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* KPI grid */}
          <div className="kpi-grid">
            {data.kpi.map(card => (
              <div key={card.label} className="kpi">
                <div className="label">{card.label}</div>
                {card.unit === "円" ? (
                  <div className="value">
                    <span className="yen">¥</span>{fmtMoney(card.value)}
                    <span className="yen" style={{ marginLeft: 2 }}>円</span>
                  </div>
                ) : (
                  <div className="value">
                    {card.value.toLocaleString()}
                    <span className="yen" style={{ fontSize: 14, marginLeft: 4 }}>{card.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 売掛金サマリー */}
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi" style={{ borderLeft: "3px solid var(--c-primary)" }}>
              <div className="label">今月請求額</div>
              <div className="value">
                <span className="yen">¥</span>{fmtMoney(data.invoice_stats?.this_month_billed ?? 0)}
                <span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span>
              </div>
            </div>
            <div className="kpi" style={{ borderLeft: `3px solid var(--c-warn)` }}>
              <div className="label">入金待ち合計</div>
              <div className="value">
                <span className="yen">¥</span>{fmtMoney(data.invoice_stats?.total_pending ?? 0)}
                <span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span>
              </div>
            </div>
            <div className="kpi" style={{ borderLeft: "3px solid var(--c-danger)", background: (data.invoice_stats?.overdue_count ?? 0) > 0 ? "color-mix(in oklab, var(--c-danger) 5%, var(--c-surface))" : undefined }}>
              <div className="label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                期限超過（入金）
                {(data.invoice_stats?.overdue_count ?? 0) > 0 && (
                  <span style={{ background: "var(--c-danger)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>
                    {data.invoice_stats.overdue_count}件
                  </span>
                )}
              </div>
              <div className="value" style={{ color: (data.invoice_stats?.overdue_count ?? 0) > 0 ? "var(--c-danger)" : undefined }}>
                <span className="yen">¥</span>{fmtMoney(data.invoice_stats?.total_overdue ?? 0)}
                <span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span>
              </div>
            </div>
          </div>

          {/* Chart row: donut (360px) + bar chart */}
          <div className="chart-row">
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">ステータス分布</div>
                  <div className="card-sub">7段階 · 全{total}件</div>
                </div>
              </div>
              <div className="card-pad">
                {data.status_distribution.length === 0
                  ? <p style={{ fontSize: 13, color: "var(--c-text-muted)", textAlign: "center", padding: "20px 0" }}>データなし</p>
                  : <DonutChart data={data.status_distribution} total={total} />
                }
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">月別 請求額推移</div>
                  <div className="card-sub">直近12ヶ月</div>
                </div>
                <div className="actions">
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11, color: "var(--c-text-muted)" }}>
                    <span style={{ width: 10, height: 10, background: "var(--c-primary)", borderRadius: 2, display: "inline-block" }} />
                    請求額
                  </span>
                </div>
              </div>
              <BarChart data={data.monthly_stats} />
            </div>
          </div>

          {/* 未入金アラーム */}
          {(data.unpaid_alerts?.length ?? 0) > 0 && (
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                    </svg>
                    未入金アラーム
                  </div>
                  <div className="card-sub">支払期日を過ぎた請求書 · {data.unpaid_alerts.length}件</div>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--c-border)", color: "var(--c-text-muted)", fontSize: 11 }}>
                      <th style={{ padding: "6px 14px", textAlign: "left", fontWeight: 600 }}>案件</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>請求番号</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>請求額</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", fontWeight: 600 }}>支払期日</th>
                      <th style={{ padding: "6px 14px", textAlign: "center", fontWeight: 600 }}>超過日数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unpaid_alerts.map((a) => (
                      <tr key={a.invoice_id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                        <td style={{ padding: "8px 14px" }}>
                          <Link href={`/projects/${a.project_id}`} style={{ color: "var(--c-primary)", textDecoration: "none", fontWeight: 500 }}>
                            {a.project_number}
                          </Link>
                          <div style={{ color: "var(--c-text-muted)", fontSize: 11, marginTop: 1 }}>{a.project_name}</div>
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--c-text-muted)" }}>{a.invoice_number ?? "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--ff-mono)", fontWeight: 600 }}>
                          ¥{Math.round(a.total_amount).toLocaleString()}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>
                          {a.payment_due_date ?? "—"}
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <span style={{ background: "var(--c-danger)", color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {a.days_overdue}日超過
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 統合期限アラート */}
          {(data.period_alerts?.length ?? 0) > 0 && (
            <PeriodAlertsCard alerts={data.period_alerts ?? []} />
          )}

          {/* 請求書年月別一覧 */}
          {(data.monthly_invoices?.length ?? 0) > 0 && (
            <MonthlyInvoicesCard groups={data.monthly_invoices ?? []} />
          )}

          {/* Bottom: work hours + timeline */}
          <div className="grid-2">

            {/* 担当者別稼働時間 */}
            {(data.user_work_hours?.length ?? 0) > 0 && (
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">担当者別稼働時間</div>
                    <div className="card-sub">今月の日報集計</div>
                  </div>
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const maxMin = Math.max(...(data.user_work_hours ?? []).map((u) => u.this_month_minutes), 1);
                    return (data.user_work_hours ?? []).map((u) => {
                      const h = Math.floor(u.this_month_minutes / 60);
                      const m = u.this_month_minutes % 60;
                      const pct = (u.this_month_minutes / maxMin) * 100;
                      return (
                        <div key={u.user_id}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                            <span style={{ fontWeight: 500 }}>{u.user_name}</span>
                            <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>
                              {h}h{m ? `${m}m` : ""}
                            </span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: "var(--c-surface-2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: "var(--c-primary)", transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">最近の活動</div>
                  <div className="card-sub">直近 20件</div>
                </div>
              </div>
              <div className="timeline">
                {data.recent_activities.length === 0 ? (
                  <div style={{ padding: "20px 14px", fontSize: 13, color: "var(--c-text-muted)", textAlign: "center" }}>活動履歴がありません</div>
                ) : data.recent_activities.slice(0, 8).map((act, i) => (
                  <div key={i} className="tl-row">
                    <div className="avatar">{act.changed_by_name.slice(0, 1)}</div>
                    <div className="what">
                      <strong>{act.changed_by_name}</strong> が{" "}
                      {ENTITY_LABEL[act.entity_type] ?? act.entity_type} を{" "}
                      {CHANGE_LABEL[act.change_type] ?? act.change_type}
                      {act.project_id && (
                        <Link href={`/projects/${act.project_id}`} style={{ color: "var(--c-primary)", marginLeft: 4, textDecoration: "none" }}>→</Link>
                      )}
                    </div>
                    <div className="when">{fmtRelTime(act.changed_at)}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(_p: ProjectListItem) => setShowModal(false)}
      />
    </AppShell>
  );
}
