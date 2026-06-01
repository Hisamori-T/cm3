"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────

type TaskStatus = "planned" | "in_progress" | "completed" | "delayed";

interface WorkType { id: string; code: string; name: string; default_color: string; }

interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  task_no: number;
  task_name: string;
  work_type: string | null;
  work_type_master: WorkType | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  progress_pct: number;
  status: TaskStatus;
  assigned_user_id: string | null;
  color: string | null;
  note: string | null;
}

interface User { id: string; full_name: string; }

// ── Constants ─────────────────────────────────────────────────

const STATUS_COLOR: Record<TaskStatus, string> = {
  planned:     "#94a3b8",
  in_progress: "#3b82f6",
  completed:   "#22c55e",
  delayed:     "#ef4444",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  planned:     "予定",
  in_progress: "進行中",
  completed:   "完了",
  delayed:     "遅延",
};

const DAY_PX = 28;
const ROW_H  = 52;

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

export default function GanttPage() {
  const { id } = useParams<{ id: string }>();
  const today = new Date().toISOString().slice(0, 10);

  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [users,     setUsers]     = useState<User[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  // inline editing
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    task_name: string; planned_start: string; planned_end: string;
    status: TaskStatus; progress_pct: number; assigned_user_id: string; note: string;
  }>({ task_name: "", planned_start: "", planned_end: "", status: "planned", progress_pct: 0, assigned_user_id: "", note: "" });

  // new task form
  const [newTask, setNewTask] = useState({ task_name: "", work_type_master_id: "", planned_start: "", planned_end: "" });

  const ganttRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, wt, us] = await Promise.all([
        apiFetch<Task[]>(`/api/v1/projects/${id}/tasks`),
        apiFetch<WorkType[]>("/api/v1/work-types"),
        apiFetch<User[]>("/api/v1/auth/users").catch(() => []),
      ]);
      setTasks(t);
      setWorkTypes(wt);
      setUsers(us);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // scroll today into view
  useEffect(() => {
    if (!ganttRef.current || !minDate) return;
    const offset = daysBetween(minDate, today) * DAY_PX - 100;
    ganttRef.current.scrollLeft = Math.max(0, offset);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // date range
  const dates = tasks.flatMap((t) => [t.planned_start, t.planned_end].filter(Boolean) as string[]);
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : addDays(today, 60);
  const totalDays = Math.max(daysBetween(minDate, maxDate) + 14, 60);
  const headerDays: string[] = [];
  for (let i = 0; i < totalDays; i++) headerDays.push(addDays(minDate, i));
  const todayOffset = daysBetween(minDate, today);

  // month groups for header
  const monthGroups: { label: string; start: number; len: number }[] = [];
  headerDays.forEach((d, i) => {
    const dt = new Date(d);
    const label = `${dt.getFullYear()}年${dt.getMonth() + 1}月`;
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== label) monthGroups.push({ label, start: i, len: 1 });
    else last.len++;
  });

  function openEdit(task: Task) {
    if (editId === task.id) { setEditId(null); return; }
    setEditId(task.id);
    setEditForm({
      task_name: task.task_name,
      planned_start: task.planned_start ?? "",
      planned_end:   task.planned_end   ?? "",
      status:        task.status,
      progress_pct:  task.progress_pct,
      assigned_user_id: task.assigned_user_id ?? "",
      note: task.note ?? "",
    });
  }

  async function handleSave(taskId: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${id}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          task_name:        editForm.task_name,
          planned_start:    editForm.planned_start   || null,
          planned_end:      editForm.planned_end     || null,
          status:           editForm.status,
          progress_pct:     editForm.progress_pct,
          assigned_user_id: editForm.assigned_user_id || null,
          note:             editForm.note || null,
        }),
      });
      setEditId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTask() {
    if (!newTask.task_name) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${id}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          task_name: newTask.task_name,
          work_type_master_id: newTask.work_type_master_id || null,
          planned_start: newTask.planned_start || null,
          planned_end:   newTask.planned_end   || null,
          task_no: tasks.length,
        }),
      });
      setShowAdd(false);
      setNewTask({ task_name: "", work_type_master_id: "", planned_start: "", planned_end: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("タスクを削除しますか？")) return;
    await apiFetch(`/api/v1/projects/${id}/tasks/${taskId}`, { method: "DELETE" });
    if (editId === taskId) setEditId(null);
    await load();
  }

  const delayedCount = tasks.filter((t) => isDelayed(t, today)).length;
  const completedCount = tasks.filter((t) => t.status === "completed" || t.progress_pct >= 100).length;

  return (
    <AppShell breadcrumbs={[{ label: "案件", href: `/projects/${id}` }, { label: "工程表" }]}>
      <div style={{ padding: "var(--sp-4)" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)", margin: 0 }}>ガントチャート工程表</h2>
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
          <Button onClick={() => setShowAdd(!showAdd)}>+ タスク追加</Button>
        </div>

        {/* タスク追加フォーム */}
        {showAdd && (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", padding: 12, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: "1 0 180px" }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>タスク名 *</div>
              <Input value={newTask.task_name} onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })} placeholder="例: 内装解体" className="h-7 text-sm" />
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>工種</div>
              <select value={newTask.work_type_master_id} onChange={(e) => setNewTask({ ...newTask, work_type_master_id: e.target.value })} style={{ width: "100%", height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 12 }}>
                <option value="">工種なし</option>
                {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 130px" }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>予定開始</div>
              <Input type="date" value={newTask.planned_start} onChange={(e) => setNewTask({ ...newTask, planned_start: e.target.value })} className="h-7 text-xs" />
            </div>
            <div style={{ flex: "0 0 130px" }}>
              <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>予定終了</div>
              <Input type="date" value={newTask.planned_end} onChange={(e) => setNewTask({ ...newTask, planned_end: e.target.value })} className="h-7 text-xs" />
            </div>
            <Button size="sm" onClick={handleAddTask} disabled={saving || !newTask.task_name}>{saving ? "追加中…" : "追加"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>キャンセル</Button>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--c-text-muted)", padding: 16 }}>読み込み中…</p>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-muted)", border: "2px dashed var(--c-border)", borderRadius: "var(--r-lg)" }}>
            工程タスクがありません。「タスク追加」から追加してください。
          </div>
        ) : (
          <div style={{ display: "flex", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>

            {/* 左：タスクリスト */}
            <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--c-border)" }}>
              {/* 左ヘッダー */}
              <div style={{ height: 56, background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", padding: "0 12px", fontWeight: 600, fontSize: 13 }}>
                タスク
              </div>

              {tasks.map((task) => {
                const delayed = isDelayed(task, today);
                const barColor = delayed ? "#ef4444" : (task.work_type_master?.default_color ?? STATUS_COLOR[task.status]);
                const isEditing = editId === task.id;
                const assigneeName = users.find((u) => u.id === task.assigned_user_id)?.full_name;

                return (
                  <div key={task.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                    {/* タスク行 */}
                    <div
                      onClick={() => openEdit(task)}
                      style={{
                        height: ROW_H, padding: "0 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                        background: isEditing ? "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))" : "var(--c-surface)",
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: barColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: delayed ? "#ef4444" : "var(--c-text)" }}>
                          {task.task_name}
                          {delayed && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700 }}>遅延</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
                          {task.work_type_master?.name && <span>{task.work_type_master.name}</span>}
                          <span style={{ padding: "0 4px", borderRadius: 3, background: STATUS_COLOR[task.status] + "22", color: STATUS_COLOR[task.status] }}>
                            {STATUS_LABEL[task.status]}
                          </span>
                          {assigneeName && <span>{assigneeName}</span>}
                        </div>
                      </div>
                      {/* 進捗 */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: task.progress_pct >= 100 ? "#16a34a" : "var(--c-text-muted)", minWidth: 32, textAlign: "right" }}>
                        {task.progress_pct}%
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                        title="削除"
                      >×</button>
                    </div>

                    {/* インライン編集フォーム */}
                    {isEditing && (
                      <div style={{ background: "color-mix(in oklab, var(--c-primary) 4%, var(--c-surface))", borderTop: "1px solid var(--c-border)", padding: "10px 10px 10px 22px" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 6 }}>タスク編集</div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Input value={editForm.task_name} onChange={(e) => setEditForm({ ...editForm, task_name: e.target.value })} placeholder="タスク名" className="h-7 text-xs" />

                          <div style={{ display: "flex", gap: 4 }}>
                            <Input type="date" value={editForm.planned_start} onChange={(e) => setEditForm({ ...editForm, planned_start: e.target.value })} className="h-7 text-xs" style={{ flex: 1 }} />
                            <span style={{ alignSelf: "center", fontSize: 10, color: "var(--c-text-muted)" }}>〜</span>
                            <Input type="date" value={editForm.planned_end} onChange={(e) => setEditForm({ ...editForm, planned_end: e.target.value })} className="h-7 text-xs" style={{ flex: 1 }} />
                          </div>

                          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })} style={{ height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 12 }}>
                            {(Object.entries(STATUS_LABEL) as [TaskStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>

                          {/* 進捗スライダー */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>
                              <span>進捗</span>
                              <span style={{ fontWeight: 700, color: editForm.progress_pct >= 100 ? "#16a34a" : "var(--c-text)" }}>{editForm.progress_pct}%</span>
                            </div>
                            <input
                              type="range" min={0} max={100} step={5}
                              value={editForm.progress_pct}
                              onChange={(e) => setEditForm({ ...editForm, progress_pct: Number(e.target.value) })}
                              style={{ width: "100%", accentColor: "var(--c-primary)" }}
                            />
                          </div>

                          {/* 担当者 */}
                          <select value={editForm.assigned_user_id} onChange={(e) => setEditForm({ ...editForm, assigned_user_id: e.target.value })} style={{ height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 12 }}>
                            <option value="">— 担当者なし —</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </select>

                          <textarea value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="メモ" rows={2} style={{ width: "100%", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "4px 8px", fontSize: 12, background: "var(--c-surface)", color: "var(--c-text)", resize: "none", fontFamily: "inherit" }} />

                          <div style={{ display: "flex", gap: 6 }}>
                            <Button size="sm" onClick={() => handleSave(task.id)} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>キャンセル</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 右：ガントエリア */}
            <div ref={ganttRef} style={{ flex: 1, overflowX: "auto", position: "relative" }}>
              <div style={{ minWidth: totalDays * DAY_PX, position: "relative" }}>

                {/* 月ヘッダー */}
                <div style={{ height: 28, display: "flex", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", position: "sticky", top: 0, zIndex: 10 }}>
                  {monthGroups.map((mg) => (
                    <div key={mg.label} style={{ width: mg.len * DAY_PX, flexShrink: 0, borderRight: "1px solid var(--c-border)", display: "flex", alignItems: "center", padding: "0 6px", fontWeight: 700, fontSize: 11, color: "var(--c-text-muted)" }}>
                      {mg.label}
                    </div>
                  ))}
                </div>

                {/* 日付ヘッダー */}
                <div style={{ height: 28, display: "flex", background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", position: "sticky", top: 28, zIndex: 10 }}>
                  {headerDays.map((d, i) => {
                    const dt = new Date(d);
                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                    const showLabel = dt.getDate() % 5 === 1 || i === 0;
                    return (
                      <div key={d} style={{ width: DAY_PX, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "var(--ff-mono)", color: isWeekend ? "#ef4444" : "var(--c-text-muted)", background: d === today ? "color-mix(in oklab, var(--c-primary) 15%, var(--c-surface))" : isWeekend ? "#fef2f2" : undefined, borderRight: "1px solid color-mix(in oklab, var(--c-border) 50%, transparent)" }}>
                        {showLabel ? dt.getDate() : ""}
                      </div>
                    );
                  })}
                </div>

                {/* タスク行（バー） */}
                {tasks.map((task) => {
                  const delayed = isDelayed(task, today);
                  const barColor = delayed ? "#ef4444" : (task.work_type_master?.default_color ?? STATUS_COLOR[task.status]);
                  const barStart = task.planned_start ? daysBetween(minDate, task.planned_start) : -1;
                  const barLen   = task.planned_start && task.planned_end ? daysBetween(task.planned_start, task.planned_end) + 1 : 0;
                  const isEditing = editId === task.id;

                  return (
                    <div key={task.id} style={{ position: "relative" }}>
                      <div style={{
                        height: ROW_H + (isEditing ? 160 : 0),
                        borderBottom: "1px solid var(--c-border)",
                        display: "flex",
                        alignItems: "flex-start",
                        paddingTop: (ROW_H - 24) / 2,
                        position: "relative",
                      }}>
                        {/* 週末背景 */}
                        {headerDays.map((d, i) => {
                          const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6;
                          return isWeekend ? (
                            <div key={d} style={{ position: "absolute", left: i * DAY_PX, width: DAY_PX, top: 0, bottom: 0, background: "#fef2f208" }} />
                          ) : null;
                        })}

                        {/* ガントバー */}
                        {barStart >= 0 && barLen > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: barStart * DAY_PX + 2,
                              width: barLen * DAY_PX - 4,
                              height: 22,
                              borderRadius: 4,
                              background: barColor,
                              opacity: 0.9,
                              display: "flex",
                              alignItems: "center",
                              overflow: "hidden",
                              boxShadow: delayed ? "0 0 0 1px #ef444444" : undefined,
                            }}
                          >
                            {/* 進捗オーバーレイ */}
                            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${task.progress_pct}%`, background: "rgba(255,255,255,0.3)", borderRadius: 4 }} />
                            <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, paddingLeft: 6, position: "relative", zIndex: 1, whiteSpace: "nowrap" }}>
                              {task.task_name.length > 12 ? task.task_name.slice(0, 10) + "…" : task.task_name}
                              {task.progress_pct > 0 && ` ${task.progress_pct}%`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 今日ライン */}
                {todayOffset >= 0 && todayOffset < totalDays && (
                  <div style={{
                    position: "absolute",
                    left: todayOffset * DAY_PX + DAY_PX / 2,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "var(--c-primary)",
                    opacity: 0.8,
                    pointerEvents: "none",
                    zIndex: 20,
                  }}>
                    <div style={{ position: "absolute", top: 56, left: "50%", transform: "translateX(-50%)", background: "var(--c-primary)", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>
                      今日
                    </div>
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
