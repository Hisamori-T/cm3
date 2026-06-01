"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";

type Weather = "sunny" | "cloudy" | "rainy" | "snowy";

const WEATHER_ICON: Record<Weather, string> = {
  sunny: "☀",
  cloudy: "☁",
  rainy: "🌧",
  snowy: "❄",
};

const WEATHER_LABEL: Record<Weather, string> = {
  sunny: "晴れ",
  cloudy: "曇り",
  rainy: "雨",
  snowy: "雪",
};

interface ReportEntry {
  id: string;
  project_id: string;
  work_content: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  working_minutes: number;
  progress_pct: number | null;
  issues: string | null;
}

interface Report {
  id: string;
  user_id: string;
  report_date: string;
  weather: Weather | null;
  temperature: number | null;
  submitted_at: string | null;
  note: string | null;
  entries: ReportEntry[];
  user_name: string | null;
}

interface Project {
  id: string;
  project_number: string;
  project_name: string;
}

function fmtDate(d: string): string {
  const date = new Date(d);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`;
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}分`;
  return `${Math.floor(m / 60)}時間${m % 60 ? m % 60 + "分" : ""}`;
}

export default function DailyReportPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editReport, setEditReport] = useState<Report | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    weather: "sunny" as Weather,
    note: "",
  });
  const [entries, setEntries] = useState([{
    project_id: "",
    work_content: "",
    start_time: "08:30",
    end_time: "17:30",
    break_minutes: 60,
    working_minutes: 480,
  }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reps, projs] = await Promise.all([
        apiFetch<Report[]>("/api/v1/daily-reports"),
        apiFetch<{ items: Project[] }>("/api/v1/projects?limit=200").then((d) => d.items),
      ]);
      setReports(reps);
      setProjects(projs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function calcWorking(start: string, end: string, brk: number): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - brk);
  }

  function updateEntry(idx: number, field: string, value: string | number) {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "start_time" || field === "end_time" || field === "break_minutes") {
      updated[idx].working_minutes = calcWorking(
        field === "start_time" ? value as string : updated[idx].start_time,
        field === "end_time" ? value as string : updated[idx].end_time,
        field === "break_minutes" ? value as number : updated[idx].break_minutes,
      );
    }
    setEntries(updated);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const created = await apiFetch<Report>("/api/v1/daily-reports", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          entries: entries.filter((e) => e.project_id),
        }),
      });
      await apiFetch(`/api/v1/daily-reports/${created.id}/submit`, { method: "POST" });
      setShowCreate(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(report: Report) {
    setEditReport(report);
    setForm({
      report_date: report.report_date,
      weather: report.weather || "sunny",
      note: report.note || "",
    });
    setEntries(report.entries.map((e) => ({
      project_id: e.project_id,
      work_content: e.work_content || "",
      start_time: e.start_time || "08:30",
      end_time: e.end_time || "17:30",
      break_minutes: e.break_minutes,
      working_minutes: e.working_minutes,
    })));
  }

  async function handleUpdate() {
    if (!editReport) return;
    setSubmitting(true);
    try {
      await apiFetch<Report>(`/api/v1/daily-reports/${editReport.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          weather: form.weather,
          note: form.note,
          entries: entries.filter((e) => e.project_id),
        }),
      });
      setEditReport(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: "日報" }]}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
          <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)" }}>日報タイムライン</h2>
          <Button onClick={() => setShowCreate(!showCreate)}>+ 日報を書く</Button>
        </div>

        {/* 日報作成フォーム */}
        {showCreate && (
          <div
            style={{
              background: "var(--c-surface)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--radius)",
              padding: "var(--sp-4)",
              marginBottom: "var(--sp-4)",
            }}
          >
            <h3 style={{ fontWeight: 600, marginBottom: "var(--sp-3)" }}>日報を書く</h3>

            <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>日付</div>
                <Input
                  type="date"
                  value={form.report_date}
                  onChange={(e) => setForm({ ...form, report_date: e.target.value })}
                  style={{ width: 160 }}
                />
              </div>
              <div>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>天気</div>
                <div style={{ display: "flex", gap: "var(--sp-1)" }}>
                  {(["sunny", "cloudy", "rainy", "snowy"] as Weather[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setForm({ ...form, weather: w })}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid var(--c-border)",
                        borderRadius: "var(--radius-sm)",
                        background: form.weather === w ? "var(--c-primary)" : "var(--c-surface)",
                        color: form.weather === w ? "#fff" : "var(--c-text)",
                        cursor: "pointer",
                        fontSize: "var(--fs-sm)",
                      }}
                    >
                      {WEATHER_ICON[w]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 作業項目 */}
            <div style={{ marginBottom: "var(--sp-3)" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: "var(--sp-2)" }}>作業項目</div>
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--c-surface-2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--sp-2) var(--sp-3)",
                    marginBottom: "var(--sp-2)",
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 0 200px" }}>
                      <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>案件 *</div>
                      <select
                        value={entry.project_id}
                        onChange={(e) => updateEntry(idx, "project_id", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          border: "1px solid var(--c-border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--fs-sm)",
                          background: "var(--c-surface)",
                          color: "var(--c-text)",
                        }}
                      >
                        <option value="">案件を選択</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_number} {p.project_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: "0 0 90px" }}>
                      <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>開始</div>
                      <Input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => updateEntry(idx, "start_time", e.target.value)}
                      />
                    </div>
                    <div style={{ flex: "0 0 90px" }}>
                      <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>終了</div>
                      <Input
                        type="time"
                        value={entry.end_time}
                        onChange={(e) => updateEntry(idx, "end_time", e.target.value)}
                      />
                    </div>
                    <div style={{ flex: "0 0 80px" }}>
                      <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>休憩(分)</div>
                      <Input
                        type="number"
                        value={entry.break_minutes}
                        onChange={(e) => updateEntry(idx, "break_minutes", Number(e.target.value))}
                        min={0}
                      />
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", paddingBottom: 6 }}>
                      実働 {fmtMinutes(entry.working_minutes)}
                    </div>
                  </div>
                  <div style={{ marginTop: "var(--sp-2)" }}>
                    <Input
                      placeholder="作業内容（例：壁解体ほぼ完了）"
                      value={entry.work_content}
                      onChange={(e) => updateEntry(idx, "work_content", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setEntries([...entries, {
                  project_id: "",
                  work_content: "",
                  start_time: "08:30",
                  end_time: "17:30",
                  break_minutes: 60,
                  working_minutes: 480,
                }])}
                style={{
                  background: "none",
                  border: "1px dashed var(--c-border)",
                  borderRadius: "var(--radius-sm)",
                  width: "100%",
                  padding: "var(--sp-2)",
                  cursor: "pointer",
                  color: "var(--c-text-muted)",
                  fontSize: "var(--fs-sm)",
                }}
              >
                + 作業を追加
              </button>
            </div>

            <div style={{ marginBottom: "var(--sp-3)" }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 2, color: "var(--c-text-muted)" }}>一言メモ（任意）</div>
              <Input
                placeholder="今日の一言..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", gap: "var(--sp-2)" }}>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "提出中…" : "提出する"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>キャンセル</Button>
            </div>
          </div>
        )}

        {/* タイムライン */}
        {loading ? (
          <p style={{ color: "var(--c-text-muted)" }}>読み込み中…</p>
        ) : reports.length === 0 ? (
          <div
            style={{
              padding: "var(--sp-8)",
              textAlign: "center",
              color: "var(--c-text-muted)",
              border: "2px dashed var(--c-border)",
              borderRadius: "var(--radius)",
            }}
          >
            まだ日報がありません。「日報を書く」から投稿してください。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  background: "var(--c-surface)",
                  border: "1px solid var(--c-border)",
                  borderRadius: "var(--radius)",
                  padding: "var(--sp-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>
                    {report.user_name || "不明"}&nbsp;
                    <span style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>
                      {fmtDate(report.report_date)}&nbsp;
                      {report.weather && WEATHER_ICON[report.weather]}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {report.submitted_at && (
                      <span style={{ fontSize: "var(--fs-xs)", background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 4 }}>
                        提出済
                      </span>
                    )}
                    {/* 自分の日報 or 管理者のみ編集可 */}
                    {(report.user_id === user?.id || ["admin", "super_admin"].includes(user?.role ?? "")) && (
                      <button
                        onClick={() => openEdit(report)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", padding: 2, display: "flex" }}
                        title="編集"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {report.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: "var(--c-surface-2)",
                      borderRadius: "var(--radius-sm)",
                      padding: "var(--sp-2) var(--sp-3)",
                      marginBottom: "var(--sp-1)",
                    }}
                  >
                    <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>
                      {entry.work_content || "（作業内容なし）"}
                    </div>
                    {(entry.start_time || entry.end_time) && (
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)", marginTop: 2 }}>
                        {entry.start_time}〜{entry.end_time}&nbsp;
                        実働: {fmtMinutes(entry.working_minutes)}
                      </div>
                    )}
                  </div>
                ))}

                {report.note && (
                  <div style={{ marginTop: "var(--sp-2)", fontSize: "var(--fs-sm)", color: "var(--c-text-muted)" }}>
                    ✏ {report.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── 日報編集モーダル ── */}
      {editReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--c-surface)", borderRadius: "var(--radius)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: "var(--fs-md)" }}>日報を修正</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditReport(null)}>閉じる</Button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 4, color: "var(--c-text-muted)" }}>天気</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(Object.keys(WEATHER_LABEL) as Weather[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setForm({ ...form, weather: w })}
                    style={{
                      padding: "4px 10px", borderRadius: "var(--radius-sm)",
                      border: `1px solid ${form.weather === w ? "var(--c-primary)" : "var(--c-border)"}`,
                      background: form.weather === w ? "var(--c-primary)" : "var(--c-surface)",
                      color: form.weather === w ? "#fff" : "var(--c-text-muted)",
                      cursor: "pointer", fontSize: 13,
                    }}
                  >
                    {WEATHER_ICON[w]} {WEATHER_LABEL[w]}
                  </button>
                ))}
              </div>
            </div>

            {entries.map((entry, idx) => (
              <div key={idx} style={{ background: "var(--c-surface-2)", borderRadius: "var(--radius-sm)", padding: "var(--sp-2) var(--sp-3)", marginBottom: "var(--sp-2)" }}>
                <div style={{ fontSize: "var(--fs-xs)", marginBottom: 4, color: "var(--c-text-muted)" }}>作業内容</div>
                <textarea
                  rows={2}
                  value={entry.work_content}
                  onChange={(e) => updateEntry(idx, "work_content", e.target.value)}
                  style={{ width: "100%", padding: "4px 8px", fontSize: 13, border: "1px solid var(--c-border)", borderRadius: 4, background: "var(--c-surface)", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>開始</div>
                    <Input type="time" value={entry.start_time} onChange={(e) => updateEntry(idx, "start_time", e.target.value)} style={{ width: 100 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-muted)" }}>終了</div>
                    <Input type="time" value={entry.end_time} onChange={(e) => updateEntry(idx, "end_time", e.target.value)} style={{ width: 100 }} />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "var(--fs-xs)", marginBottom: 4, color: "var(--c-text-muted)" }}>一言メモ</div>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="今日の一言..." />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={handleUpdate} disabled={submitting}>
                {submitting ? "保存中…" : "保存する"}
              </Button>
              <Button variant="ghost" onClick={() => setEditReport(null)}>キャンセル</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
