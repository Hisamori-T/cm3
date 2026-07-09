"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { fmtNum, fmtRelTime } from "@/lib/format";
import type { ProjectListItem } from "@/types/project";

interface KpiCard { label: string; value: number; unit: string; }
interface StatusCount { status: string; label: string; count: number; }
interface MonthlyStat { month: string; amount: number; count: number; }
interface RecentActivity {
  entity_type: string;
  change_type: string;
  project_id: string | null;
  changed_by_name: string;
  changed_at: string;
}
interface DashboardData {
  kpi: KpiCard[];
  status_distribution: StatusCount[];
  monthly_stats: MonthlyStat[];
  recent_activities: RecentActivity[];
  period: string;
}

type Period = "current" | "previous" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  current: "今期",
  previous: "前期",
  all: "全期間",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
};

const ENTITY_LABEL: Record<string, string> = {
  project: "案件",
  quote: "見積書",
};
const CHANGE_LABEL: Record<string, string> = {
  created: "作成",
  updated: "更新",
  deleted: "削除",
  status_changed: "ステータス変更",
};

const fmtMonth = (m: string) => `${parseInt(m.slice(5), 10)}月`;
const fmtYen = (v: number) => `¥${fmtNum(v)}`;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("current");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async (p: Period) => {
    setIsLoading(true);
    try {
      const d = await apiFetch<DashboardData>(`/api/v1/dashboard?period=${p}`);
      setData(d);
    } catch {
      /* 401 → /login redirect by apiFetch */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  const totalProjects =
    data?.status_distribution.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <AppShell
      breadcrumbs={[{ label: "ダッシュボード" }]}
      action={
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          新規案件
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="toolbar">
        <h1>ダッシュボード</h1>
        <span style={{ flex: 1 }} />
        <div className="seg">
          {(["current", "previous", "all"] as Period[]).map((p) => (
            <button
              key={p}
              className={period === p ? "on" : ""}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--c-text-muted)",
            fontSize: 13,
          }}
        >
          読み込み中...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* KPI グリッド */}
          <div className="kpi-grid">
            {data.kpi.map((card) => (
              <div key={card.label} className="kpi">
                <div className="label">{card.label}</div>
                <div className="value">
                  {fmtNum(card.value)}
                  <span
                    className="yen"
                    style={{ fontSize: 14, marginLeft: 4 }}
                  >
                    {card.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* チャート行 */}
          <div className="chart-row">
            {/* 月別見積推移 */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">月別見積推移</div>
                  <div className="card-sub">
                    {PERIOD_LABEL[period]} · 金額（円）
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 16px 12px" }}>
                {data.monthly_stats.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--c-text-muted)",
                      textAlign: "center",
                      padding: "20px 0",
                    }}
                  >
                    データなし
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={data.monthly_stats}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="month"
                        tickFormatter={fmtMonth}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) =>
                          `${Math.round(v / 10000)}万`
                        }
                      />
                      <Tooltip
                        formatter={(value) => [
                          fmtYen(Number(value)),
                          "見積金額",
                        ]}
                        labelFormatter={(label) => fmtMonth(String(label))}
                      />
                      <Bar
                        dataKey="amount"
                        fill="var(--c-primary)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ステータス分布 */}
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">ステータス分布</div>
                  <div className="card-sub">全{totalProjects}件</div>
                </div>
              </div>
              <div style={{ padding: "0 16px 12px" }}>
                {totalProjects === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--c-text-muted)",
                      textAlign: "center",
                      padding: "20px 0",
                    }}
                  >
                    データなし
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.status_distribution}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {data.status_distribution.map((s) => (
                          <Cell
                            key={s.status}
                            fill={STATUS_COLOR[s.status] ?? "#ccc"}
                          />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => (
                          <span style={{ fontSize: 11 }}>{v}</span>
                        )}
                      />
                      <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* 最近の活動 */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">最近の活動</div>
                <div className="card-sub">直近 20件</div>
              </div>
            </div>
            <div className="timeline">
              {data.recent_activities.length === 0 ? (
                <div
                  style={{
                    padding: "20px 14px",
                    fontSize: 13,
                    color: "var(--c-text-muted)",
                    textAlign: "center",
                  }}
                >
                  活動履歴がありません
                </div>
              ) : (
                data.recent_activities.slice(0, 10).map((act, i) => (
                  <div key={i} className="tl-row">
                    <div className="avatar">
                      {act.changed_by_name.slice(0, 1)}
                    </div>
                    <div className="what">
                      <strong>{act.changed_by_name}</strong>
                      {" が "}
                      {ENTITY_LABEL[act.entity_type] ?? act.entity_type}
                      {" を "}
                      {CHANGE_LABEL[act.change_type] ?? act.change_type}
                      {act.project_id && (
                        <>
                          {" · "}
                          <Link
                            href={`/projects/${act.project_id}`}
                            style={{
                              color: "var(--c-primary)",
                              textDecoration: "none",
                              fontFamily: "var(--ff-mono)",
                              fontSize: 11,
                            }}
                          >
                            →
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="when">{fmtRelTime(act.changed_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(_p: ProjectListItem) => {
          setShowModal(false);
          load(period);
        }}
      />
    </AppShell>
  );
}
