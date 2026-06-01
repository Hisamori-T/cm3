"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";

// ── Types ──────────────────────────────────────────────────────

type EventType = "meeting" | "site_visit" | "milestone" | "personal" | "vendor_visit";
type Weather = "sunny" | "cloudy" | "rainy" | "snowy";

interface ScheduleEvent {
  id: string;
  title: string;
  event_type: EventType;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  organizer_id: string;
  organizer_name: string | null;
  project_name: string | null;
  color: string | null;
}

interface ReportEntry {
  id: string;
  project_id: string;
  project_name: string | null;
  project_number: string | null;
  work_content: string | null;
  start_time: string | null;
  end_time: string | null;
  working_minutes: number;
}

interface DailyReport {
  id: string;
  user_id: string;
  user_name: string | null;
  report_date: string;
  weather: Weather | null;
  note: string | null;
  submitted_at: string | null;
  entries: ReportEntry[];
}

interface Project {
  id: string;
  project_number: string;
  project_name: string;
}

interface PaymentDue {
  id: string;
  payment_due_date: string;
  vendor_name: string | null;
  project_name: string | null;
  project_number: string | null;
  total_amount: number;
  status: string;
}

// ── Constants ─────────────────────────────────────────────────

const EVENT_COLORS: Record<EventType, string> = {
  meeting:      "#6366f1",
  site_visit:   "#0891b2",
  milestone:    "#dc2626",
  personal:     "#6b7280",
  vendor_visit: "#d97706",
};

const EVENT_LABELS: Record<EventType, string> = {
  meeting:      "打合せ",
  site_visit:   "現場",
  milestone:    "節目",
  personal:     "個人",
  vendor_visit: "業者",
};

const WEATHER_ICON: Record<Weather, string> = {
  sunny: "☀", cloudy: "☁", rainy: "🌧", snowy: "❄",
};

const REPORT_COLOR  = "#16a34a";
const PAYMENT_COLOR = "#7c3aed";
const DAY_LABELS   = ["日", "月", "火", "水", "木", "金", "土"];
const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── Legend ────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11 }}>
      {[
        { color: EVENT_COLORS.site_visit,   label: "担当者スケジュール" },
        { color: REPORT_COLOR,              label: "日報（提出済）" },
        { color: EVENT_COLORS.meeting,      label: "打合せ" },
        { color: EVENT_COLORS.milestone,    label: "マイルストーン" },
        { color: EVENT_COLORS.vendor_visit, label: "業者訪問" },
        { color: EVENT_COLORS.personal,     label: "その他" },
        { color: PAYMENT_COLOR,              label: "支払期日" },
      ].map(({ color, label }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();

  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users,  setUsers]  = useState<{ id: string; full_name: string }[]>([]);
  const [payments, setPayments] = useState<PaymentDue[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayMode, setDayMode] = useState<"view" | "add-event" | "add-report">("view");

  // event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    event_type: "meeting" as EventType,
    start_at: "",
    end_at: "",
    all_day: false,
    location: "",
    project_id: "",
    attendee_user_ids: [] as string[],
  });
  const [savingEvent, setSavingEvent] = useState(false);

  // report form state
  const [reportForm, setReportForm] = useState({
    report_date: "",
    weather: "sunny" as Weather,
    note: "",
  });
  const [reportEntries, setReportEntries] = useState([{
    project_id: "", work_content: "",
    start_time: "08:30", end_time: "17:30",
    break_minutes: 60, working_minutes: 480,
  }]);
  const [savingReport, setSavingReport] = useState(false);

  // ── load ─────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const toDate   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const [evs, reps, projs, us, pays] = await Promise.all([
        apiFetch<ScheduleEvent[]>(`/api/v1/schedule?from_dt=${encodeURIComponent(from)}&to_dt=${encodeURIComponent(to)}`),
        apiFetch<DailyReport[]>(`/api/v1/daily-reports?from_date=${fromDate}&to_date=${toDate}`),
        apiFetch<{ items: Project[] }>("/api/v1/projects?limit=200").then((d) => d.items),
        apiFetch<{ id: string; full_name: string }[]>("/api/v1/auth/users").catch(() => []),
        apiFetch<PaymentDue[]>("/api/v1/purchase-orders/upcoming-payments?days=90").catch(() => []),
      ]);
      setEvents(evs);
      setReports(reps);
      setProjects(projs);
      setUsers(us);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // ── helpers ──────────────────────────────────────────────────

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function ds(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function dayEvents(day: number) { return events.filter((e) => e.start_at.startsWith(ds(day))); }
  function dayReports(day: number) {
    const d = ds(day);
    return reports.filter((r) => r.report_date === d || r.report_date.startsWith(d));
  }
  function dayPayments(day: number) {
    return payments.filter((p) => p.payment_due_date === ds(day));
  }

  function selectDay(day: number) {
    const d = ds(day);
    setSelectedDay(d);
    setDayMode("view");
    setEventForm({
      title: "", event_type: "meeting",
      start_at: `${d}T09:00`, end_at: `${d}T10:00`,
      all_day: false, location: "", project_id: "", attendee_user_ids: [],
    });
    setReportForm({ report_date: d, weather: "sunny", note: "" });
    setReportEntries([{ project_id: "", work_content: "", start_time: "08:30", end_time: "17:30", break_minutes: 60, working_minutes: 480 }]);
  }

  function calcWorking(start: string, end: string, brk: number): number {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - brk);
  }

  function updateEntry(idx: number, field: string, value: string | number) {
    const updated = [...reportEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    if (["start_time", "end_time", "break_minutes"].includes(field)) {
      updated[idx].working_minutes = calcWorking(
        field === "start_time" ? value as string : updated[idx].start_time,
        field === "end_time"   ? value as string : updated[idx].end_time,
        field === "break_minutes" ? value as number : updated[idx].break_minutes,
      );
    }
    setReportEntries(updated);
  }

  function fmtMinutes(m: number): string {
    if (m <= 0) return "—";
    if (m < 60) return `${m}分`;
    return `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ""}`;
  }

  function fmtDayLabel(d: string): string {
    const dt = new Date(d + "T00:00:00");
    const dows = ["日","月","火","水","木","金","土"];
    return `${dt.getMonth() + 1}月${dt.getDate()}日（${dows[dt.getDay()]}）`;
  }

  const prevMonth = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); };

  // ── API actions ───────────────────────────────────────────────

  async function handleCreateEvent() {
    setSavingEvent(true);
    try {
      await apiFetch("/api/v1/schedule", {
        method: "POST",
        body: JSON.stringify({
          ...eventForm,
          start_at: eventForm.start_at + ":00",
          end_at:   eventForm.end_at   + ":00",
          project_id:         eventForm.project_id || null,
          attendee_user_ids:  eventForm.attendee_user_ids,
        }),
      });
      setDayMode("view");
      await load();
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleCreateReport() {
    setSavingReport(true);
    try {
      const created = await apiFetch<{ id: string }>("/api/v1/daily-reports", {
        method: "POST",
        body: JSON.stringify({
          ...reportForm,
          entries: reportEntries.filter((e) => e.project_id),
        }),
      });
      await apiFetch(`/api/v1/daily-reports/${created.id}/submit`, { method: "POST" });
      setDayMode("view");
      await load();
    } finally {
      setSavingReport(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("削除しますか？")) return;
    await apiFetch(`/api/v1/schedule/${id}`, { method: "DELETE" });
    await load();
  }

  // ── derived ──────────────────────────────────────────────────

  const selEvs  = selectedDay ? events.filter((e) => e.start_at.startsWith(selectedDay)) : [];
  const selReps = selectedDay
    ? reports.filter((r) => r.report_date === selectedDay || r.report_date.startsWith(selectedDay))
    : [];
  const selPays = selectedDay ? payments.filter((p) => p.payment_due_date === selectedDay) : [];

  // ── render ────────────────────────────────────────────────────

  return (
    <AppShell breadcrumbs={[{ label: "カレンダー" }]}>
      <div style={{ padding: "var(--sp-4)" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-3)", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "4px 10px", cursor: "pointer" }}>‹</button>
            <h2 style={{ fontWeight: 700, fontSize: "var(--fs-lg)", minWidth: 120, textAlign: "center" }}>{year}年 {MONTH_LABELS[month]}</h2>
            <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "4px 10px", cursor: "pointer" }}>›</button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); selectDay(today.getDate()); }}
              style={{ background: "none", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
            >今日</button>
          </div>
          <Legend />
        </div>

        {/* 2カラム: カレンダー + 日詳細パネル */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

          {/* ── カレンダーグリッド ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1, background: "var(--c-border)",
              border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)", overflow: "hidden",
            }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{
                  background: "var(--c-surface-2)", padding: "4px 6px",
                  textAlign: "center", fontSize: 11, fontWeight: 600,
                  color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : "var(--c-text-muted)",
                }}>{d}</div>
              ))}

              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} style={{ background: "var(--c-surface-2)", minHeight: 72 }} />;

                const isToday    = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = ds(day) === selectedDay;
                const evs  = dayEvents(day);
                const reps = dayReports(day);
                const pays = dayPayments(day);

                // chip priority: site_visit → reports → payments → other events
                const siteChips = evs
                  .filter((e) => e.event_type === "site_visit")
                  .map((e) => ({ key: e.id, label: e.project_name ?? e.title, color: EVENT_COLORS.site_visit }));
                const repChips = reps.flatMap((r) =>
                  r.entries.length > 0
                    ? r.entries.map((e) => ({ key: `r${r.id}${e.id}`, label: e.project_name ?? "日報", color: REPORT_COLOR }))
                    : [{ key: `r${r.id}`, label: "日報", color: REPORT_COLOR }]
                );
                const payChips = pays.map((p) => ({
                  key: `pay${p.id}`,
                  label: `💴${p.vendor_name ?? "支払"}`,
                  color: PAYMENT_COLOR,
                }));
                const otherChips = evs
                  .filter((e) => e.event_type !== "site_visit")
                  .map((e) => ({ key: e.id, label: e.title, color: e.color ?? EVENT_COLORS[e.event_type] }));
                const allChips = [...siteChips, ...repChips, ...payChips, ...otherChips];
                const overflow = allChips.length - 3;

                return (
                  <div
                    key={idx}
                    onClick={() => selectDay(day)}
                    style={{
                      background: isSelected
                        ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))"
                        : "var(--c-surface)",
                      minHeight: 72, padding: "4px 3px", cursor: "pointer",
                      outline: isSelected ? "2px solid var(--c-primary)" : "none",
                      outlineOffset: -2,
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: isToday ? "var(--c-primary)" : "transparent",
                      color: isToday ? "#fff" : "var(--c-text)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: isToday ? 700 : 400, marginBottom: 2,
                    }}>{day}</div>

                    {allChips.slice(0, 3).map((chip) => (
                      <div key={chip.key} style={{
                        background: chip.color, color: "#fff",
                        borderRadius: 2, padding: "1px 3px", fontSize: 9,
                        marginBottom: 1, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }} title={chip.label}>{chip.label}</div>
                    ))}
                    {overflow > 0 && <div style={{ fontSize: 9, color: "var(--c-text-muted)" }}>+{overflow}件</div>}
                  </div>
                );
              })}
            </div>
            {loading && (
              <div style={{ textAlign: "center", padding: 12, color: "var(--c-text-muted)", fontSize: 12 }}>読み込み中...</div>
            )}
          </div>

          {/* ── 日詳細パネル ── */}
          {selectedDay && (
            <div style={{
              width: 320, flexShrink: 0,
              background: "var(--c-surface)", border: "1px solid var(--c-border)",
              borderRadius: "var(--r-lg)", overflow: "hidden",
            }}>
              {/* パネルヘッダー */}
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtDayLabel(selectedDay)}</div>
                <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ maxHeight: "74vh", overflowY: "auto" }}>

                {/* イベント */}
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>イベント</div>
                  {selEvs.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>なし</div>
                    : selEvs.map((ev) => (
                      <div key={ev.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color ?? EVENT_COLORS[ev.event_type], flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{ev.title}</div>
                          <div style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                            {EVENT_LABELS[ev.event_type]}
                            {!ev.all_day && ` ${ev.start_at.slice(11, 16)}〜${ev.end_at.slice(11, 16)}`}
                            {ev.location && ` @ ${ev.location}`}
                            {ev.project_name && ` | ${ev.project_name}`}
                          </div>
                        </div>
                        <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted)", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    ))
                  }
                </div>

                <div style={{ height: 1, background: "var(--c-border)" }} />

                {/* 日報 */}
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>日報</div>
                  {selReps.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>なし</div>
                    : selReps.map((r) => (
                      <div key={r.id} style={{
                        marginBottom: 6, padding: "6px 8px",
                        background: "color-mix(in oklab, #16a34a 8%, var(--c-surface))",
                        borderRadius: "var(--r-md)",
                        border: "1px solid color-mix(in oklab, #16a34a 25%, var(--c-border))",
                        fontSize: 12,
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 3, display: "flex", gap: 6, alignItems: "center" }}>
                          {r.weather && <span>{WEATHER_ICON[r.weather]}</span>}
                          <span>{r.user_name ?? "不明"}</span>
                          {r.submitted_at && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 400 }}>✓提出済</span>}
                        </div>
                        {r.entries.map((e) => (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                              {e.project_number ? `${e.project_number} ` : ""}{e.project_name ?? "—"}
                            </span>
                            <span style={{ color: "var(--c-text-muted)", flexShrink: 0 }}>{fmtMinutes(e.working_minutes)}</span>
                          </div>
                        ))}
                        {r.note && <div style={{ marginTop: 3, fontSize: 11, color: "var(--c-text-muted)", fontStyle: "italic" }}>{r.note}</div>}
                      </div>
                    ))
                  }
                </div>

                <div style={{ height: 1, background: "var(--c-border)" }} />

                {/* 支払期日 */}
                {selPays.length > 0 && (
                  <>
                    <div style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: PAYMENT_COLOR, letterSpacing: "0.05em", marginBottom: 6 }}>💴 支払期日</div>
                      {selPays.map((p) => (
                        <div key={p.id} style={{ marginBottom: 6, padding: "6px 8px", background: "#f5f3ff", borderRadius: "var(--r-md)", border: `1px solid ${PAYMENT_COLOR}44`, fontSize: 12 }}>
                          <div style={{ fontWeight: 600, color: PAYMENT_COLOR }}>{p.vendor_name ?? "業者不明"}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
                            <span style={{ color: "var(--c-text-muted)" }}>{p.project_number} {p.project_name}</span>
                            <span style={{ fontWeight: 700 }}>¥{p.total_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 1, background: "var(--c-border)" }} />
                  </>
                )}

                {/* アクションボタン */}
                {dayMode === "view" && (
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <Button variant="ghost" size="sm" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => setDayMode("add-event")}>
                      ＋ イベント追加
                    </Button>
                    <button
                      onClick={() => setDayMode("add-report")}
                      style={{
                        background: "#16a34a", color: "#fff",
                        border: "none", borderRadius: "var(--r-md)",
                        padding: "6px 12px", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      ＋ 日報を書く
                    </button>
                  </div>
                )}

                {/* イベント追加フォーム */}
                {dayMode === "add-event" && (
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>イベント追加</div>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>タイトル *</div>
                      <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="打合せ" className="h-7 text-xs" />
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>種別</div>
                      <select
                        value={eventForm.event_type}
                        onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value as EventType })}
                        style={{ width: "100%", height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 12 }}
                      >
                        {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    {/* 担当者スケジュール専用フィールド */}
                    {eventForm.event_type === "site_visit" && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>案件</div>
                          <select
                            value={eventForm.project_id}
                            onChange={(e) => setEventForm({ ...eventForm, project_id: e.target.value })}
                            style={{ width: "100%", height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 12 }}
                          >
                            <option value="">— 案件を選択 —</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>{p.project_number} {p.project_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 4 }}>担当者（複数可）</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {users.map((u) => (
                              <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={eventForm.attendee_user_ids.includes(u.id)}
                                  onChange={(e) => {
                                    const ids = eventForm.attendee_user_ids;
                                    setEventForm({
                                      ...eventForm,
                                      attendee_user_ids: e.target.checked
                                        ? [...ids, u.id]
                                        : ids.filter((i) => i !== u.id),
                                    });
                                  }}
                                />
                                {u.full_name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>開始</div>
                        <Input type="datetime-local" value={eventForm.start_at} onChange={(e) => setEventForm({ ...eventForm, start_at: e.target.value })} className="h-7 text-xs" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>終了</div>
                        <Input type="datetime-local" value={eventForm.end_at} onChange={(e) => setEventForm({ ...eventForm, end_at: e.target.value })} className="h-7 text-xs" />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>場所</div>
                      <Input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="会議室A / 現場名" className="h-7 text-xs" />
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <Button size="sm" onClick={handleCreateEvent} disabled={savingEvent || !eventForm.title}>
                        {savingEvent ? "保存中…" : "保存"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDayMode("view")}>キャンセル</Button>
                    </div>
                  </div>
                )}

                {/* 日報入力フォーム */}
                {dayMode === "add-report" && (
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>日報を書く</div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>日付</div>
                        <Input type="date" value={reportForm.report_date} onChange={(e) => setReportForm({ ...reportForm, report_date: e.target.value })} className="h-7 text-xs" style={{ width: 130 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>天気</div>
                        <div style={{ display: "flex", gap: 3 }}>
                          {(["sunny", "cloudy", "rainy", "snowy"] as Weather[]).map((w) => (
                            <button
                              key={w}
                              onClick={() => setReportForm({ ...reportForm, weather: w })}
                              style={{
                                width: 28, height: 28, border: "1px solid var(--c-border)",
                                borderRadius: "var(--r-md)", cursor: "pointer", fontSize: 14,
                                background: reportForm.weather === w ? "var(--c-primary)" : "var(--c-surface)",
                              }}
                            >{WEATHER_ICON[w]}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 作業エントリ */}
                    {reportEntries.map((entry, idx) => (
                      <div key={idx} style={{ border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "8px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-muted)" }}>案件 {idx + 1}</div>
                          {idx > 0 && (
                            <button onClick={() => setReportEntries(reportEntries.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-danger)", fontSize: 11 }}>削除</button>
                          )}
                        </div>
                        <select
                          value={entry.project_id}
                          onChange={(e) => updateEntry(idx, "project_id", e.target.value)}
                          style={{ width: "100%", height: 28, border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", background: "var(--c-surface)", color: entry.project_id ? "var(--c-text)" : "var(--c-text-muted)", padding: "0 8px", fontSize: 12 }}
                        >
                          <option value="">— 案件を選択（必須） —</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.project_number} {p.project_name}</option>
                          ))}
                        </select>
                        <Input
                          value={entry.work_content}
                          onChange={(e) => updateEntry(idx, "work_content", e.target.value)}
                          placeholder="作業内容（例：内装クロス貼り）"
                          className="h-7 text-xs"
                        />
                        <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}>
                          <Input type="time" value={entry.start_time} onChange={(e) => updateEntry(idx, "start_time", e.target.value)} className="h-7 text-xs" style={{ width: 80 }} />
                          <span style={{ color: "var(--c-text-muted)" }}>〜</span>
                          <Input type="time" value={entry.end_time} onChange={(e) => updateEntry(idx, "end_time", e.target.value)} className="h-7 text-xs" style={{ width: 80 }} />
                          <span style={{ color: "var(--c-text-muted)", fontSize: 10, whiteSpace: "nowrap" }}>実働 {fmtMinutes(entry.working_minutes)}</span>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setReportEntries([...reportEntries, { project_id: "", work_content: "", start_time: "08:30", end_time: "17:30", break_minutes: 60, working_minutes: 480 }])}
                      style={{ background: "none", border: "1px dashed var(--c-border)", borderRadius: "var(--r-md)", padding: "6px", fontSize: 12, color: "var(--c-text-muted)", cursor: "pointer", width: "100%" }}
                    >
                      ＋ 案件を追加
                    </button>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--c-text-muted)", marginBottom: 2 }}>メモ・申し送り</div>
                      <textarea
                        value={reportForm.note}
                        onChange={(e) => setReportForm({ ...reportForm, note: e.target.value })}
                        placeholder="明日の予定・気になった点など"
                        rows={2}
                        style={{ width: "100%", border: "1px solid var(--c-border)", borderRadius: "var(--r-md)", padding: "6px 8px", fontSize: 12, background: "var(--c-surface)", color: "var(--c-text)", resize: "vertical", fontFamily: "inherit" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <Button
                        size="sm"
                        onClick={handleCreateReport}
                        disabled={savingReport || !reportEntries.some((e) => e.project_id)}
                        style={{ background: "#16a34a", color: "#fff" }}
                      >
                        {savingReport ? "提出中…" : "提出する"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDayMode("view")}>キャンセル</Button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
