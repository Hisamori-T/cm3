"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────

interface Task {
  id: string;
  project_id: string;
  project_name: string | null;
  project_number: string | null;
  task_name: string;
  work_type: string | null;
  planned_start: string | null;
  planned_end: string | null;
  progress_pct: number;
  status: string;
  color: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  work_type_master: { default_color: string } | null;
}

// ── Constants ─────────────────────────────────────────────────

const DAY_PX  = 22;
const ROW_H   = 34;
const HEAD_H  = 56;   // month(28) + day(28)

const STATUS_COLOR: Record<string, string> = {
  planned: "#94a3b8", in_progress: "#3b82f6", completed: "#22c55e", delayed: "#ef4444",
};

// ── Helpers ───────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function isDelayed(task: Task, today: string): boolean {
  return !!task.planned_end && task.planned_end < today && task.progress_pct < 100;
}

// ── Main ──────────────────────────────────────────────────────

export default function AllGanttPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [axis,    setAxis]    = useState<"project" | "member">("project");

  const ganttRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Task[]>("/api/v1/gantt/all");
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // date range
  const dates = tasks.flatMap((t) => [t.planned_start, t.planned_end].filter(Boolean) as string[]);
  const minDate   = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
  const maxDate   = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : addDays(today, 60);
  const totalDays = Math.max(daysBetween(minDate, maxDate) + 14, 60);
  const todayOffset = daysBetween(minDate, today);

  const headerDays: string[] = [];
  for (let i = 0; i < totalDays; i++) headerDays.push(addDays(minDate, i));

  // month groups
  const monthGroups: { label: string; len: number }[] = [];
  headerDays.forEach((d) => {
    const dt = new Date(d);
    const label = `${dt.getFullYear()}年${dt.getMonth() + 1}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== label) monthGroups.push({ label, len: 1 });
    else last.len++;
  });

  // scroll to today on load
  useEffect(() => {
    if (!ganttRef.current) return;
    const offset = todayOffset * DAY_PX - 160;
    ganttRef.current.scrollLeft = Math.max(0, offset);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // grouping
  const groups: Map<string, { label: string; href?: string; tasks: Task[] }> = new Map();

  if (axis === "project") {
    tasks.forEach((t) => {
      const key = t.project_id;
      if (!groups.has(key)) groups.set(key, {
        label: t.project_name ? `${t.project_number ?? ""} ${t.project_name}` : t.project_id,
        href: `/projects/${t.project_id}`,
        tasks: [],
      });
      groups.get(key)!.tasks.push(t);
    });
  } else {
    // member axis: group by assigned user
    const noAssignee = "__none__";
    tasks.forEach((t) => {
      const key = t.assigned_user_id ?? noAssignee;
      const label = t.assigned_user_name ?? "担当者未設定";
      if (!groups.has(key)) groups.set(key, { label, tasks: [] });
      groups.get(key)!.tasks.push(t);
    });
  }

  const delayedCount  = tasks.filter((t) => isDelayed(t, today)).length;
  const completedCount = tasks.filter((t) => t.status === "completed" || t.progress_pct >= 100).length;

  return (
    <AppShell breadcrumbs={[{ label: "全社工程表" }]}>
      <div style={{ padding: "var(--sp-4)" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)", margin: 0 }}>全社工程表</h2>
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              <span style={{ padding: "2px 10px", borderRadius: 10, background: "color-mix(in oklab, #22c55e 12%, var(--c-surface))", color: "#16a34a", fontWeight: 600 }}>
                完了 {completedCount}/{tasks.length}
              </span>
              {delayedCount > 0 && (
                <span style={{ padding: "2px 10px", borderRadius: 10, background: "color-mix(in oklab, #ef4444 12%, var(--c-surface))", color: "#ef4444", fontWeight: 600 }}>
                  遅延 {delayedCount}件
                </span>
              )}
            </div>
          </div>
          {/* 軸切替 */}
          <div style={{ display: "flex", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            {(["project", "member"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAxis(a)}
                style={{
                  padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: axis === a ? "var(--c-primary)" : "var(--c-surface)",
                  color: axis === a ? "#fff" : "var(--c-text)",
                }}
              >
                {a === "project" ? "案件軸" : "メンバー軸"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--c-text-muted)", padding: 16 }}>読み込み中…</p>
        ) : tasks.length === 0 ? (
          <p style={{ color: "var(--c-text-muted)", padding: 16 }}>工程タスクがありません。各案件から工程を登録してください。</p>
        ) : (
          <div style={{ display: "flex", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>

            {/* 左：名称列 */}
            <div style={{ width: 280, flexShrink: 0, borderRight: "1px solid var(--c-border)" }}>
              {/* 左ヘッダー */}
              <div style={{ height: HEAD_H, background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", padding: "0 12px", fontWeight: 600, fontSize: 13 }}>
                {axis === "project" ? "案件 / タスク" : "担当者 / タスク"}
              </div>

              {Array.from(groups.entries()).map(([key, group]) => (
                <div key={key}>
                  {/* グループヘッダー */}
                  <div style={{ height: ROW_H + 2, background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", padding: "0 12px", display: "flex", alignItems: "center", fontWeight: 600, fontSize: 12 }}>
                    {group.href ? (
                      <Link href={group.href} style={{ color: "var(--c-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={group.label}>
                        {group.label}
                      </Link>
                    ) : (
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</span>
                    )}
                  </div>

                  {/* タスク行 */}
                  {group.tasks.map((task) => {
                    const delayed = isDelayed(task, today);
                    return (
                      <div key={task.id} style={{ height: ROW_H, borderBottom: "1px solid var(--c-border)", padding: "0 12px 0 22px", display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: delayed ? "#ef4444" : (task.work_type_master?.default_color ?? STATUS_COLOR[task.status] ?? "#94a3b8") }} />
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: delayed ? "#ef4444" : "var(--c-text)", fontWeight: delayed ? 600 : 400 }}>
                            {task.task_name}
                          </div>
                          {axis === "project" && task.assigned_user_name && (
                            <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{task.assigned_user_name}</div>
                          )}
                          {axis === "member" && task.project_name && (
                            <div style={{ fontSize: 10, color: "var(--c-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.project_name}</div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: delayed ? "#ef4444" : "var(--c-text-muted)", fontWeight: delayed ? 700 : 400, flexShrink: 0 }}>
                          {task.progress_pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 右：ガントエリア */}
            <div ref={ganttRef} style={{ flex: 1, overflowX: "auto", position: "relative" }}>
              <div style={{ minWidth: totalDays * DAY_PX, position: "relative" }}>

                {/* 月ヘッダー */}
                <div style={{ height: 28, display: "flex", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", position: "sticky", top: 0, zIndex: 10 }}>
                  {monthGroups.map((mg) => (
                    <div key={mg.label} style={{ width: mg.len * DAY_PX, flexShrink: 0, borderRight: "1px solid var(--c-border)", display: "flex", alignItems: "center", padding: "0 6px", fontWeight: 700, fontSize: 10, color: "var(--c-text-muted)" }}>
                      {mg.label}
                    </div>
                  ))}
                </div>

                {/* 日付ヘッダー */}
                <div style={{ height: 28, display: "flex", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", position: "sticky", top: 28, zIndex: 10 }}>
                  {headerDays.map((d, i) => {
                    const dt = new Date(d);
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    const showLabel = dt.getDate() % 7 === 1 || i === 0;
                    return (
                      <div key={d} style={{ width: DAY_PX, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "var(--ff-mono)", color: isWeekend ? "#ef4444" : "var(--c-text-muted)", background: d === today ? "color-mix(in oklab, var(--c-primary) 15%, var(--c-surface))" : isWeekend ? "#fef2f2" : undefined, borderRight: "1px solid color-mix(in oklab, var(--c-border) 40%, transparent)" }}>
                        {showLabel ? dt.getDate() : ""}
                      </div>
                    );
                  })}
                </div>

                {/* グループ＋タスク行 */}
                {Array.from(groups.entries()).map(([key, group]) => (
                  <div key={key}>
                    {/* グループヘッダー行（空行） */}
                    <div style={{ height: ROW_H + 2, background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", position: "relative" }}>
                      {todayOffset >= 0 && todayOffset < totalDays && (
                        <div style={{ position: "absolute", left: todayOffset * DAY_PX + DAY_PX / 2, top: 0, bottom: 0, width: 1, background: "var(--c-primary)", opacity: 0.4 }} />
                      )}
                    </div>

                    {/* タスクバー行 */}
                    {group.tasks.map((task) => {
                      const delayed = isDelayed(task, today);
                      const barColor = delayed ? "#ef4444" : (task.work_type_master?.default_color ?? STATUS_COLOR[task.status] ?? "#94a3b8");
                      const barStart = task.planned_start ? daysBetween(minDate, task.planned_start) : -1;
                      const barLen   = task.planned_start && task.planned_end ? daysBetween(task.planned_start, task.planned_end) + 1 : 0;

                      return (
                        <div key={task.id} style={{ height: ROW_H, borderBottom: "1px solid var(--c-border)", position: "relative" }}>
                          {/* 週末背景 */}
                          {headerDays.map((d, i) => {
                            const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6;
                            return isWeekend ? (
                              <div key={d} style={{ position: "absolute", left: i * DAY_PX, width: DAY_PX, top: 0, bottom: 0, background: "#fef2f20a" }} />
                            ) : null;
                          })}
                          {barStart >= 0 && barLen > 0 && (
                            <div style={{
                              position: "absolute",
                              left: barStart * DAY_PX + 1, top: (ROW_H - 18) / 2,
                              width: barLen * DAY_PX - 2, height: 18,
                              borderRadius: 3, background: barColor, opacity: 0.85,
                              overflow: "hidden",
                              boxShadow: delayed ? "0 0 0 1px #ef444466" : undefined,
                            }}>
                              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${task.progress_pct}%`, background: "rgba(255,255,255,0.28)", borderRadius: 3 }} />
                            </div>
                          )}
                          {/* 今日ライン */}
                          {todayOffset >= 0 && todayOffset < totalDays && (
                            <div style={{ position: "absolute", left: todayOffset * DAY_PX + DAY_PX / 2, top: 0, bottom: 0, width: 1, background: "var(--c-primary)", opacity: 0.6, zIndex: 5 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* 今日ラベル */}
                {todayOffset >= 0 && todayOffset < totalDays && (
                  <div style={{
                    position: "absolute", top: 0,
                    left: todayOffset * DAY_PX + DAY_PX / 2,
                    transform: "translateX(-50%)",
                    background: "var(--c-primary)", color: "#fff",
                    fontSize: 9, fontWeight: 700, padding: "1px 5px",
                    borderRadius: "0 0 3px 3px", zIndex: 20, pointerEvents: "none",
                  }}>
                    今日
                  </div>
                )}

              </div>
            </div>

          </div>
        )}
      </div>
    </AppShell>
  );
}
