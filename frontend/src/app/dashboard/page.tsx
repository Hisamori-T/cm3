"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { fmtMoney, fmtRelTime, fmtYen } from "@/lib/format";
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
  const CH = 160;
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
            <text key={i} x={SX + i * BS + BW / 2} y={196}>{d.month.slice(5)}月</text>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** 期限アラートカード（dashboard.html の .alert-card / .alert-row 準拠） */
function AlertCard({ periodAlerts, unpaidAlerts }: { periodAlerts: PeriodAlertItem[]; unpaidAlerts: UnpaidAlert[] }) {
  const byType = (type: string) => periodAlerts.filter(a => a.alert_type === type);
  const overdue = byType("payment_overdue");
  const scheduleOver = byType("schedule_overrun");
  const notIssued = byType("invoice_not_issued");
  const longUnpaid = unpaidAlerts;
  const dueSoon = byType("payment_due_soon");

  const total = overdue.length + scheduleOver.length + notIssued.length + Math.min(longUnpaid.length, 20) + dueSoon.length;

  const rows: { type: "danger" | "warn" | "info"; icon: React.ReactNode; label: string; detail: string; count: number; href: string }[] = [];

  if (scheduleOver.length > 0) {
    const names = scheduleOver.slice(0, 2).map(a => a.project_name).join(" / ");
    const avgDays = Math.round(scheduleOver.reduce((s, a) => s + a.days, 0) / scheduleOver.length);
    rows.push({
      type: "danger",
      icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
      label: "工期超過",
      detail: `${names}${scheduleOver.length > 2 ? " 他" : ""} · 平均${avgDays}日遅延`,
      count: scheduleOver.length,
      href: "/projects",
    });
  }
  if (notIssued.length > 0) {
    rows.push({
      type: "warn",
      icon: <><path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M9 13h6M9 17h6" /></>,
      label: "請求書未発行",
      detail: "完工後 30日以上経過",
      count: notIssued.length,
      href: "/projects",
    });
  }
  if (longUnpaid.length > 0) {
    rows.push({
      type: "info",
      icon: <><path d="M12 1l3 6 6 1-4.5 4.5L18 19l-6-3-6 3 1.5-6.5L3 8l6-1 3-6z" /></>,
      label: "入金未確認",
      detail: "請求書発行 60日経過",
      count: longUnpaid.length,
      href: "/purchases",
    });
  }
  if (overdue.length > 0) {
    rows.push({
      type: "danger",
      icon: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
      label: "支払期日超過",
      detail: `${overdue.length}件の請求書が期限超過`,
      count: overdue.length,
      href: "/purchases",
    });
  }
  if (dueSoon.length > 0) {
    rows.push({
      type: "warn",
      icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
      label: "支払期日近迫",
      detail: "3日以内に期限",
      count: dueSoon.length,
      href: "/purchases",
    });
  }

  return (
    <div className="alert-card">
      <div className="card-head">
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-warn)" strokeWidth="1.8">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            期限アラート
          </div>
          <div className="card-sub">対応が必要な案件 · 計{total}件</div>
        </div>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: "24px 14px", fontSize: 13, color: "var(--c-text-muted)", textAlign: "center" }}>
          対応が必要なアラートはありません
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className={`alert-row ${row.type}`}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{row.icon}</svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="label">{row.label}</div>
            <div className="muted" style={{ fontSize: 11 }}>{row.detail}</div>
          </div>
          <div className="count">{row.count}<small>件</small></div>
          <Link href={row.href} className="link">確認 →</Link>
        </div>
      ))}
    </div>
  );
}

/** 請求書年月別一覧カード（左列 1.4fr、dashboard.html ランキング部分の置換） */
function MonthlyInvoicesCard({ groups }: { groups: MonthlyInvoiceGroup[] }) {
  const router = useRouter();
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
          <div className="card-sub">クリックで展開 · 行クリックで詳細へ</div>
        </div>
      </div>
      {groups.length === 0 && (
        <div style={{ padding: "24px 14px", fontSize: 13, color: "var(--c-text-muted)", textAlign: "center" }}>
          請求書がありません
        </div>
      )}
      {groups.map(g => (
        <div key={g.year_month}>
          <button
            onClick={() => toggle(g.year_month)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 16px", border: "none", borderTop: "1px solid var(--c-border)",
              background: "var(--c-surface-2)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--c-text)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open.has(g.year_month) ? <path d="M6 9l6 6 6-6" /> : <path d="M9 18l6-6-6-6" />}
              </svg>
              {g.display}
              <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 400, color: "var(--c-text-muted)" }}>
                {g.invoices.length}件
              </span>
            </span>
            <span style={{ fontFamily: "var(--ff-mono)", fontSize: 12, color: "var(--c-text-muted)", fontWeight: 400 }}>
              ¥{Math.round(g.total_billed).toLocaleString()} / 入金 ¥{Math.round(g.total_paid).toLocaleString()}
            </span>
          </button>
          {open.has(g.year_month) && (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>工事名</th>
                  <th style={{ textAlign: "left" }}>発注者</th>
                  <th className="num">総額（税込）</th>
                  <th className="num">入金済</th>
                </tr>
              </thead>
              <tbody>
                {g.invoices.map(inv => {
                  const fullyPaid = inv.total_paid >= inv.total_amount && inv.total_amount > 0;
                  return (
                    <tr key={inv.invoice_id} style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/projects/${inv.project_id}/invoice/${inv.invoice_id}`)}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.project_name}</div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{inv.invoice_number}</div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{inv.client_name || "—"}</td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", fontWeight: 600 }}>
                        ¥{Math.round(inv.total_amount).toLocaleString()}
                      </td>
                      <td className="num" style={{ fontFamily: "var(--ff-mono)", color: fullyPaid ? "var(--c-success)" : "var(--c-danger)" }}>
                        {inv.total_paid > 0 ? `¥${Math.round(inv.total_paid).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

/** ダッシュボード (S02 dashboard.html 準拠) */
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
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── KPI グリッド（4枚）*/}
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

          {/* ── 売掛金サマリー（3枚）*/}
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="kpi" style={{ borderLeft: "3px solid var(--c-primary)" }}>
              <div className="label">今月請求額</div>
              <div className="value"><span className="yen">¥</span>{fmtMoney(data.invoice_stats?.this_month_billed ?? 0)}<span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span></div>
            </div>
            <div className="kpi" style={{ borderLeft: "3px solid var(--c-warn)" }}>
              <div className="label">入金待ち合計</div>
              <div className="value"><span className="yen">¥</span>{fmtMoney(data.invoice_stats?.total_pending ?? 0)}<span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span></div>
            </div>
            <div className="kpi" style={{ borderLeft: "3px solid var(--c-danger)" }}>
              <div className="label">
                期限超過（入金）
                {(data.invoice_stats?.overdue_count ?? 0) > 0 && (
                  <span style={{ background: "var(--c-danger)", color: "#fff", borderRadius: "var(--r-pill)", fontSize: 10, fontWeight: 700, padding: "1px 7px", marginLeft: 6 }}>
                    {data.invoice_stats.overdue_count}件
                  </span>
                )}
              </div>
              <div className="value" style={{ color: (data.invoice_stats?.overdue_count ?? 0) > 0 ? "var(--c-danger)" : undefined }}>
                <span className="yen">¥</span>{fmtMoney(data.invoice_stats?.total_overdue ?? 0)}<span className="yen" style={{ fontSize: 13, marginLeft: 2 }}>円</span>
              </div>
            </div>
          </div>

          {/* ── チャート行：ドーナツ(360px) + バーチャート */}
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
                  : <DonutChart data={data.status_distribution} total={total} />}
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

          {/* ── grid-2: 請求書一覧（左1.4fr） + アラート・タイムライン（右1fr）*/}
          <div className="grid-2">

            {/* 左: 請求書年月別一覧（ランキング置き換え） */}
            <MonthlyInvoicesCard groups={data.monthly_invoices ?? []} />

            {/* 右: アラート + タイムライン（縦積み） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

              {/* 期限アラート（dashboard.html .alert-card 準拠） */}
              <AlertCard
                periodAlerts={data.period_alerts ?? []}
                unpaidAlerts={data.unpaid_alerts ?? []}
              />

              {/* 担当者別稼働時間（日報データがある場合のみ） */}
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
                      const maxMin = Math.max(...(data.user_work_hours ?? []).map(u => u.this_month_minutes), 1);
                      return (data.user_work_hours ?? []).map(u => {
                        const h = Math.floor(u.this_month_minutes / 60);
                        const m = u.this_month_minutes % 60;
                        return (
                          <div key={u.user_id}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                              <span style={{ fontWeight: 500 }}>{u.user_name}</span>
                              <span style={{ fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)" }}>{h}h{m ? `${m}m` : ""}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: "var(--r-pill)", background: "var(--c-surface-2)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(u.this_month_minutes / maxMin) * 100}%`, borderRadius: "var(--r-pill)", background: "var(--c-primary)" }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* 最近の活動タイムライン */}
              <div className="card" style={{ minWidth: 0 }}>
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
                        <strong>{act.changed_by_name}</strong>{" "}が{" "}
                        {ENTITY_LABEL[act.entity_type] ?? act.entity_type} を{" "}
                        {CHANGE_LABEL[act.change_type] ?? act.change_type}
                        {act.project_id && (
                          <> · <Link href={`/projects/${act.project_id}`}
                            style={{ color: "var(--c-primary)", textDecoration: "none", fontFamily: "var(--ff-mono)", fontSize: 11 }}>
                            →
                          </Link></>
                        )}
                      </div>
                      <div className="when">{fmtRelTime(act.changed_at)}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(_p: ProjectListItem) => { setShowModal(false); load(); }}
      />
    </AppShell>
  );
}
