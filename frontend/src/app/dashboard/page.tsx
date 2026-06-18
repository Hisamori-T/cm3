"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { fmtNum, fmtRelTime } from "@/lib/format";
import type { ProjectListItem } from "@/types/project";

interface KpiCard { label: string; value: number; unit: string; }
interface StatusCount { status: string; label: string; count: number; }
interface MonthlyStat { month: string; project_count: number; }
interface DeadlineAlert {
  project_id: string; project_number: string; project_name: string;
  deadline: string; days_left: number; alert_type: string;
}
interface RecentActivity {
  entity_type: string; change_type: string;
  project_id: string | null; changed_by_name: string; changed_at: string;
}
interface UserWorkHours {
  user_id: string;
  user_name: string;
  this_month_minutes: number;
}
interface DashboardData {
  kpi: KpiCard[];
  status_distribution: StatusCount[];
  monthly_stats: MonthlyStat[];
  deadline_alerts: DeadlineAlert[];
  recent_activities: RecentActivity[];
  user_work_hours: UserWorkHours[];
}

const STATUS_COLOR: Record<string, string> = {
  quote: "var(--c-status-quote)", ordered: "var(--c-status-order)",
  started: "var(--c-status-start)", in_progress: "var(--c-status-progress)",
  completed: "var(--c-status-done)", billed: "var(--c-status-billed)", paid: "var(--c-status-paid)",
};
const ENTITY_LABEL: Record<string, string> = {
  project: "案件", quote: "見積書",
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

/** 月別新規案件数 SVG バーチャート */
function BarChart({ data }: { data: MonthlyStat[] }) {
  const maxVal = Math.max(...data.map(d => d.project_count), 1);
  const CH = 160;
  const BW = 30, BS = 55, SX = 50;
  const yTick = (i: number) => 180 - (i / 4) * CH;
  const bH = (v: number) => (v / maxVal) * CH;
  const bY = (v: number) => 180 - bH(v);
  return (
    <div className="bar-chart">
      <svg className="bar-svg" viewBox="0 0 720 200" preserveAspectRatio="none">
        <g stroke="var(--c-border)" strokeDasharray="2 3" strokeWidth="0.5">
          {[0, 1, 2, 3, 4].map(i => <line key={i} x1="40" y1={yTick(i)} x2="710" y2={yTick(i)} />)}
        </g>
        <g fontSize="9" fill="var(--c-text-subtle)" fontFamily="var(--ff-mono)">
          {[0, 1, 2, 3, 4].map(i => (
            <text key={i} x="35" y={yTick(i) + 2} textAnchor="end">
              {Math.round((maxVal / 4) * i)}
            </text>
          ))}
        </g>
        <g fill="var(--c-primary)" opacity="0.92">
          {data.map((d, i) => {
            const h = bH(d.project_count);
            return h > 0 ? (
              <rect key={i} x={SX + i * BS} y={bY(d.project_count)} width={BW} height={h} />
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

/** ダッシュボード */
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

          {/* ── KPI グリッド */}
          <div className="kpi-grid">
            {data.kpi.map(card => (
              <div key={card.label} className="kpi">
                <div className="label">{card.label}</div>
                <div className="value">
                  {fmtNum(card.value)}
                  <span className="yen" style={{ fontSize: 14, marginLeft: 4 }}>{card.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── チャート行：ドーナツ + バーチャート */}
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
                  <div className="card-title">月別 新規案件数</div>
                  <div className="card-sub">直近12ヶ月</div>
                </div>
              </div>
              <BarChart data={data.monthly_stats} />
            </div>
          </div>

          {/* ── 下段：期限アラート + 稼働時間 + タイムライン */}
          <div className="grid-2">

            {/* 左: 期限アラート */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-warn)" strokeWidth="1.8">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <path d="M12 9v4M12 17h.01" />
                    </svg>
                    期限アラート
                  </div>
                  <div className="card-sub">工期・契約期限 30日以内</div>
                </div>
              </div>
              {data.deadline_alerts.length === 0 ? (
                <div style={{ padding: "24px 14px", fontSize: 13, color: "var(--c-text-muted)", textAlign: "center" }}>
                  期限アラートはありません
                </div>
              ) : (
                <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.deadline_alerts.map((a, i) => (
                    <Link key={i} href={`/projects/${a.project_id}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: a.days_left <= 7 ? "color-mix(in oklab,var(--c-danger) 6%,var(--c-surface))" : "var(--c-surface-2)", textDecoration: "none", borderLeft: `3px solid ${a.days_left <= 7 ? "var(--c-danger)" : "var(--c-warn)"}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.project_name}</div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{a.project_number} · {a.alert_type === "contract_end" ? "契約終了" : "実工期終了"}</div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--ff-mono)", fontWeight: 700, fontSize: 14, color: a.days_left <= 7 ? "var(--c-danger)" : "var(--c-warn)" }}>{a.days_left}日</div>
                        <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{a.deadline}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 右: 稼働時間 + タイムライン */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

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
