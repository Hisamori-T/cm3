"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ProjectDetail, ProjectStatus, ProjectUpdate } from "@/types/project";
import { PREV_CONSTRUCTION_LABEL, PROJECT_STATUS_LABEL } from "@/types/project";
import type { QCDSResponse } from "@/types/qcds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteSearch } from "@/components/client/SiteSearch";
import type { SiteSearchValue } from "@/components/client/SiteSearch";
import { fmtYen } from "@/lib/format";
import { EditField } from "@/modules/project/EditField";
import { EditSelect } from "@/modules/project/EditSelect";

const STATUS_CLASS: Record<ProjectStatus, string> = {
  quote: "s-quote", ordered: "s-order", started: "s-start",
  in_progress: "s-progress", completed: "s-done", billed: "s-billed", paid: "s-paid",
};

const STATUS_COLOR: Record<ProjectStatus, string> = {
  quote:       "var(--c-status-quote)",
  ordered:     "var(--c-status-order)",
  started:     "var(--c-status-start)",
  in_progress: "var(--c-status-progress)",
  completed:   "var(--c-status-done)",
  billed:      "var(--c-status-billed)",
  paid:        "var(--c-status-paid)",
};

const STATUS_ORDER: ProjectStatus[] = ["quote", "ordered", "started", "in_progress", "completed", "billed", "paid"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pctStr(val: number, base: number | null | undefined): string {
  if (!base || base === 0) return "—";
  return `${((val / base) * 100).toFixed(1)}%`;
}


/** 案件詳細画面（S04）。 */
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [qcds, setQcds] = useState<QCDSResponse | null>(null);
  const [quoteSubtotal, setQuoteSubtotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryTab, setSummaryTab] = useState<"budget" | "agreed" | "settlement">("budget");
  const [form, setForm] = useState<ProjectUpdate>({});
  const [siteSearch, setSiteSearch] = useState<SiteSearchValue>({ clientId: null, clientName: "", siteId: null, siteName: null });
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  const fetchProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
      setProject(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/projects");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  const fetchQcds = useCallback(async () => {
    try {
      const data = await apiFetch<QCDSResponse>(`/api/v1/projects/${id}/qcds`);
      setQcds(data);
    } catch {
      setQcds(null);
    }
  }, [id]);

  const fetchQuoteSubtotal = useCallback(async () => {
    try {
      const qs = await apiFetch<{ id: string; subtotal: number | null }[]>(`/api/v1/projects/${id}/quotes`);
      if (qs.length > 0 && qs[0].subtotal) setQuoteSubtotal(qs[0].subtotal);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchProject();
      fetchQcds();
      fetchQuoteSubtotal();
      apiFetch<{ id: string; full_name: string }[]>("/api/v1/auth/users")
        .then(setUsers)
        .catch(() => {});
    }
  }, [authLoading, user, fetchProject, fetchQcds, fetchQuoteSubtotal]);

  const startEdit = () => {
    if (!project) return;
    setSiteSearch({
      clientId: project.client_id,
      clientName: project.client_name ?? "",
      siteId: project.client_site_id,
      siteName: null,
    });
    setForm({
      project_name: project.project_name,
      project_number: project.project_number,
      client_name: project.client_name ?? "",
      client_id: project.client_id,
      client_site_id: project.client_site_id,
      original_client_name: project.original_client_name ?? "",
      project_location: project.project_location ?? "",
      order_type: project.order_type ?? undefined,
      contract_type: project.contract_type ?? undefined,
      awarding_type: project.awarding_type ?? undefined,
      payment_condition: project.payment_condition ?? "",
      project_summary: project.project_summary ?? "",
      prev_construction_type: project.prev_construction_type ?? undefined,
      client_contact_company: project.client_contact_company ?? "",
      client_contact_person: project.client_contact_person ?? "",
      client_contact_phone: project.client_contact_phone ?? "",
      project_price: project.project_price ?? undefined,
      period_quote_start: project.period_quote_start ?? "",
      period_quote_end: project.period_quote_end ?? "",
      period_contract_start: project.period_contract_start ?? "",
      period_contract_end: project.period_contract_end ?? "",
      period_actual_start: project.period_actual_start ?? "",
      period_actual_end: project.period_actual_end ?? "",
      sales_person_id: project.sales_person_id ?? null,
      construction_person_id: project.construction_person_id ?? null,
    });
    setIsEditing(true);
    setError(null);
  };

  const cancelEdit = () => { setIsEditing(false); setError(null); };

  const saveEdit = async () => {
    if (!project) return;
    setIsSaving(true);
    setError(null);
    const payload: ProjectUpdate = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    );
    try {
      const updated = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("その工事番号は既に使用されています");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("編集権限がありません");
      } else {
        setError("保存に失敗しました");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (newStatus: ProjectStatus) => {
    if (!project || newStatus === project.status) return;
    setIsChangingStatus(true);
    setError(null);
    try {
      const updated = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      setProject(updated);
    } catch {
      setError("ステータスの変更に失敗しました");
    } finally {
      setIsChangingStatus(false);
    }
  };

  const f = (k: keyof ProjectUpdate) => String(form[k] ?? "");
  const set = (k: keyof ProjectUpdate) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const canEdit = ["admin", "super_admin", "manager"].includes(user?.role ?? "") || (user && project && user.id === project.created_by);

  /* QCDS summary calc */
  const directCost = qcds
    ? summaryTab === "budget" ? qcds.calc.direct_cost_budget
      : summaryTab === "agreed" ? qcds.calc.direct_cost_agreed
      : qcds.calc.direct_cost_settlement
    : 0;
  const siteOverhead = qcds?.calc.site_overhead_total ?? 0;
  const subtotal = directCost + siteOverhead;
  const overhead = qcds
    ? qcds.calc.construction_dept_overhead + qcds.calc.shared_overhead + qcds.calc.general_admin_cost
    : 0;
  const totalCost = subtotal + overhead;
  // 工事価格: 案件フィールド > 顧客見積 subtotal の順でフォールバック
  const projectPrice = project?.project_price ?? quoteSubtotal ?? 0;
  const operatingProfit = projectPrice > 0 ? projectPrice - totalCost : 0;

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: project?.project_number ?? "…" },
      ]}
      action={
        !isEditing ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const token = typeof window !== "undefined" ? localStorage.getItem("cmv3_access_token") : "";
              if (!token) return;
              const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
              fetch(`${base}/api/v1/projects/${id}/export`, {
                headers: { Authorization: `Bearer ${token}` },
              }).then((r) => r.blob()).then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `工事台帳_${project?.project_number}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            <Button variant="default" size="sm">Excel出力</Button>
          </a>
        ) : undefined
      }
    >
      {(authLoading || isLoading) && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中...
        </div>
      )}

      {!isLoading && project && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ステータス変更バー */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: "var(--c-text-muted)", whiteSpace: "nowrap" }}>
              ステータス変更：
            </span>
            <div className="stseg">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  className={project.status === s ? "on" : ""}
                  style={project.status === s ? { color: STATUS_COLOR[s] } : undefined}
                  onClick={() => changeStatus(s)}
                  disabled={isChangingStatus || !canEdit}
                >
                  <span className="dot" />
                  {PROJECT_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <span style={{ marginLeft: "auto", fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-muted)" }}>
              最終更新 {formatDate(project.updated_at)}
            </span>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13,
              background: "var(--c-danger-bg)",
              border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
              color: "var(--c-danger)",
            }}>
              {error}
            </div>
          )}

          {/* 2fr 1fr グリッド */}
          <div className="pd-grid">

            {/* ===== LEFT ===== */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

              {/* 案件情報 */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">案件情報</div>
                    <div className="card-sub">{isEditing ? "編集中" : "工事・発注者・工期・概要"}</div>
                  </div>
                  {canEdit && (
                    <div className="actions">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving}>キャンセル</Button>
                          <Button variant="primary" size="sm" onClick={saveEdit} disabled={isSaving}>
                            {isSaving ? "保存中..." : "保存"}
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={startEdit}>編集</Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="field-grid">
                  {isEditing ? (
                    <>
                      <EditField label="工事名" value={f("project_name")} onChange={set("project_name")} />
                      <EditField label="工事番号" value={f("project_number")} onChange={set("project_number")} />
                      <EditField label="工事場所" value={f("project_location")} onChange={set("project_location")} />
                      <div className="k" style={{ alignSelf: "flex-start", paddingTop: 8 }}>発注者</div>
                      <div className="v" style={{ flexDirection: "column", alignItems: "stretch", padding: "4px 0" }}>
                        <SiteSearch
                          value={siteSearch}
                          onChange={v => {
                            setSiteSearch(v);
                            setForm(prev => ({
                              ...prev,
                              client_name: v.clientName || prev.client_name,
                              client_id: v.clientId,
                              client_site_id: v.siteId,
                            }));
                          }}
                          placeholder="顧客名・コードで検索"
                        />
                        {!siteSearch.clientId && (
                          <div style={{ marginTop: 4 }}>
                            <Input
                              value={f("client_name")}
                              onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                              placeholder="または顧客名を直接入力"
                              className="h-7 text-sm w-full"
                            />
                          </div>
                        )}
                      </div>
                      <EditField label="元発注者" value={f("original_client_name")} onChange={set("original_client_name")} />
                      <EditSelect label="発注区分" value={f("order_type")} options={[{ value: "private", label: "民間" }, { value: "government", label: "官庁" }]} onChange={set("order_type")} />
                      <EditSelect label="請負区分" value={f("contract_type")} options={[{ value: "prime", label: "元請" }, { value: "sub", label: "下請" }]} onChange={set("contract_type")} />
                      <EditSelect label="受注区分" value={f("awarding_type")} options={[{ value: "special", label: "特命" }, { value: "competitive", label: "競争" }]} onChange={set("awarding_type")} />
                      <EditField label="工事価格" value={f("project_price")} onChange={set("project_price")} type="number" />
                      <EditField label="工期(見積)開始" value={f("period_quote_start")} onChange={set("period_quote_start")} type="date" />
                      <EditField label="工期(見積)終了" value={f("period_quote_end")} onChange={set("period_quote_end")} type="date" />
                      <EditField label="工期(契約)開始" value={f("period_contract_start")} onChange={set("period_contract_start")} type="date" />
                      <EditField label="工期(契約)終了" value={f("period_contract_end")} onChange={set("period_contract_end")} type="date" />
                      <EditField label="工期(実施)開始" value={f("period_actual_start")} onChange={set("period_actual_start")} type="date" />
                      <EditField label="工期(実施)終了" value={f("period_actual_end")} onChange={set("period_actual_end")} type="date" />
                      <EditField label="支払条件" value={f("payment_condition")} onChange={set("payment_condition")} />
                      <EditField label="工事概要" value={f("project_summary")} onChange={set("project_summary")} />
                      <EditSelect label="前回施工" value={f("prev_construction_type")} options={[{ value: "own", label: "当社" }, { value: "other", label: "他社" }, { value: "none", label: "なし" }]} onChange={set("prev_construction_type")} />
                    </>
                  ) : (
                    <>
                      <div className="k">工事名</div>
                      <div className="v">{project.project_name}</div>

                      <div className="k">工事場所</div>
                      <div className="v">{project.project_location ?? "—"}</div>

                      <div className="k">発注者</div>
                      <div className="v">
                        {project.client_id ? (
                          <Link href={`/clients/${project.client_id}`} style={{ color: "var(--c-primary)", textDecoration: "none", fontWeight: 500 }}>
                            {project.client_name ?? "—"}
                          </Link>
                        ) : (project.client_name ?? "—")}
                      </div>

                      <div className="k">元発注者</div>
                      <div className="v" style={{ color: project.original_client_name ? undefined : "var(--c-text-muted)" }}>
                        {project.original_client_name ?? "— （元請）"}
                      </div>

                      <div className="k">工期（見積）</div>
                      <div className="v">
                        {(project.period_quote_start || project.period_quote_end)
                          ? <><span className="num">{project.period_quote_start ?? "—"}</span> 〜 <span className="num">{project.period_quote_end ?? "—"}</span></>
                          : "—"}
                      </div>

                      <div className="k">工期（契約）</div>
                      <div className="v">
                        {(project.period_contract_start || project.period_contract_end)
                          ? <><span className="num">{project.period_contract_start ?? "—"}</span> 〜 <span className="num">{project.period_contract_end ?? "—"}</span></>
                          : "—"}
                      </div>

                      <div className="k">工期（実施）</div>
                      <div className="v">
                        {project.period_actual_start
                          ? <><span className="num">{project.period_actual_start}</span> 〜 <span className="num">{project.period_actual_end ?? "進行中"}</span></>
                          : "—"}
                      </div>

                      <div className="k">発受注区分</div>
                      <div className="v" style={{ flexWrap: "wrap", gap: 4 }}>
                        <span className={`chip ${project.order_type === "private" ? "on" : ""}`}>民間</span>
                        <span className={`chip ${project.order_type === "government" ? "on" : ""}`}>官庁</span>
                        <span className={`chip ${project.contract_type === "prime" ? "on" : ""}`}>元請</span>
                        <span className={`chip ${project.contract_type === "sub" ? "on" : ""}`}>下請</span>
                        <span className={`chip ${project.awarding_type === "special" ? "on" : ""}`}>特命</span>
                        <span className={`chip ${project.awarding_type === "competitive" ? "on" : ""}`}>競争</span>
                      </div>

                      <div className="k">支払条件</div>
                      <div className="v">{project.payment_condition ?? "—"}</div>

                      <div className="k">前施工区分</div>
                      <div className="v">
                        {project.prev_construction_type ? PREV_CONSTRUCTION_LABEL[project.prev_construction_type] : "—"}
                        {project.prev_construction_year ? ` (${project.prev_construction_year}年)` : ""}
                      </div>

                      <div className="k">工事概要</div>
                      <div className="v" style={{ display: "block", lineHeight: 1.6, padding: "10px 12px", whiteSpace: "pre-wrap", alignSelf: "start" }}>
                        {project.project_summary ?? "—"}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 担当者 */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">担当者</div>
                    <div className="card-sub">{isEditing ? "編集中" : "客先・当社"}</div>
                  </div>
                  {canEdit && (
                    <div className="actions">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving}>キャンセル</Button>
                          <Button variant="primary" size="sm" onClick={saveEdit} disabled={isSaving}>
                            {isSaving ? "保存中..." : "保存"}
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={startEdit}>編集</Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="field-grid">
                  {isEditing ? (
                    <>
                      <EditField label="客先 会社" value={f("client_contact_company")} onChange={set("client_contact_company")} />
                      <EditField label="客先 担当" value={f("client_contact_person")} onChange={set("client_contact_person")} />
                      <EditField label="電話 / FAX" value={f("client_contact_phone")} onChange={set("client_contact_phone")} />
                      {/* 当社担当者 */}
                      <div className="k">当社 営業</div>
                      <div className="v">
                        <select
                          value={String(form.sales_person_id ?? "")}
                          onChange={e => setForm(p => ({ ...p, sales_person_id: e.target.value || null }))}
                          style={{ height: 28, width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 13, outline: "none" }}
                        >
                          <option value="">— 未設定 —</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      </div>
                      <div className="k">当社 工事</div>
                      <div className="v">
                        <select
                          value={String(form.construction_person_id ?? "")}
                          onChange={e => setForm(p => ({ ...p, construction_person_id: e.target.value || null }))}
                          style={{ height: 28, width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text)", padding: "0 8px", fontSize: 13, outline: "none" }}
                        >
                          <option value="">— 未設定 —</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="k">客先 会社</div>
                      <div className="v">{project.client_contact_company ?? "—"}</div>

                      <div className="k">客先 担当</div>
                      <div className="v">{project.client_contact_person ?? "—"}</div>

                      <div className="k">電話 / FAX</div>
                      <div className="v">
                        <span className="num">{project.client_contact_phone ?? "—"}</span>
                      </div>

                      <div className="k">当社 営業</div>
                      <div className="v" style={{ gap: 8 }}>
                        {project.sales_person_name ? (
                          <>
                            <span className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: "var(--c-primary)", flexShrink: 0 }}>
                              {project.sales_person_name[0]}
                            </span>
                            {project.sales_person_name}
                          </>
                        ) : "—"}
                      </div>

                      <div className="k">当社 工事</div>
                      <div className="v" style={{ gap: 8 }}>
                        {project.construction_person_name ? (
                          <>
                            <span className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: "var(--c-status-progress)", flexShrink: 0 }}>
                              {project.construction_person_name[0]}
                            </span>
                            {project.construction_person_name}
                          </>
                        ) : "—"}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* ===== RIGHT ===== */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

              {/* 工事割出サマリー */}
              <div className="summary">
                <div className="summary-head">
                  <div className="ttl">工事価格</div>
                  <div className="price">
                    {project.project_price != null
                      ? fmtYen(project.project_price)
                      : quoteSubtotal != null
                        ? <>{fmtYen(quoteSubtotal)}<span style={{ fontSize: 10, color: "var(--c-text-muted)", marginLeft: 4 }}>（顧客見積より）</span></>
                        : "未設定"}
                  </div>
                </div>
                <div className="summary-tabs">
                  {(["budget", "agreed", "settlement"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={summaryTab === tab ? "on" : ""}
                      onClick={() => setSummaryTab(tab)}
                    >
                      {tab === "budget" ? "実行予算" : tab === "agreed" ? "取決見通" : "精算見通"}
                    </button>
                  ))}
                </div>
                <div className="summary-body">
                  {qcds ? (
                    <>
                      <div className="sum-row">
                        <div className="k">直接工事費</div>
                        <div className="v">{fmtYen(directCost)}</div>
                        <div className="r">{pctStr(directCost, projectPrice)}</div>
                      </div>
                      <div className="sum-row">
                        <div className="k">現場経費</div>
                        <div className="v">{fmtYen(siteOverhead)}</div>
                        <div className="r">{pctStr(siteOverhead, projectPrice)}</div>
                      </div>
                      <div className="sum-row total-row">
                        <div className="k">小計</div>
                        <div className="v">{fmtYen(subtotal)}</div>
                        <div className="r">{pctStr(subtotal, projectPrice)}</div>
                      </div>
                      <div className="sum-row">
                        <div className="k">経費（共通配賦・一般管理）</div>
                        <div className="v">{fmtYen(overhead)}</div>
                        <div className="r">{pctStr(overhead, projectPrice)}</div>
                      </div>
                      {projectPrice > 0 && (
                        <div className="sum-row profit">
                          <div className="k">営業利益①</div>
                          <div className="v">{fmtYen(operatingProfit)}</div>
                          <div className="r">{pctStr(operatingProfit, projectPrice)}</div>
                        </div>
                      )}
                      {qcds.calc.target_operating_profit > 0 && (
                        <div className="sum-row target">
                          <div className="k">目標営業利益</div>
                          <div className="v">{fmtYen(qcds.calc.target_operating_profit)}</div>
                          <div className="r">{pctStr(qcds.calc.target_operating_profit, projectPrice)}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: "24px 14px", textAlign: "center" }}>
                      <p style={{ fontSize: 13, color: "var(--c-text-muted)", marginBottom: 8 }}>
                        QCDSデータが未登録です
                      </p>
                      <Link href={`/projects/${id}/qcds`}>
                        <Button variant="ghost" size="sm">QCDS を入力する</Button>
                      </Link>
                    </div>
                  )}
                </div>
                {qcds && (
                  <div className="budget-bits">
                    <div className="bbit">
                      <div className="k">労災保険料</div>
                      <div className="v">{fmtYen(qcds.calc.labor_insurance)}</div>
                    </div>
                    <div className="bbit">
                      <div className="k">工事保険料</div>
                      <div className="v">{fmtYen(qcds.calc.construction_insurance)}</div>
                    </div>
                    <div className="bbit">
                      <div className="k">通信交通費</div>
                      <div className="v">{fmtYen(qcds.communication_cost)}</div>
                    </div>
                    <div className="bbit">
                      <div className="k">事務用品費</div>
                      <div className="v">{fmtYen(qcds.office_supplies)}</div>
                    </div>
                    <div className="bbit">
                      <div className="k">特殊保険料</div>
                      <div className="v">{fmtYen(qcds.calc.special_insurance)}</div>
                    </div>
                    <div className="bbit">
                      <div className="k">雑費</div>
                      <div className="v">{fmtYen(qcds.misc_cost)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* クイックリンク */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">クイックリンク</div>
                    <div className="card-sub">この案件に紐づく台帳・記録</div>
                  </div>
                </div>
                <div className="qlinks">
                  <Link href={`/projects/${id}/qcds`} className="qlink">
                    <div className="ico">
                      <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" /></svg>
                    </div>
                    <div className="nm">QCDS</div>
                    <div className="desc">取決見通表</div>
                    <div className="meta">{qcds ? `更新 ${formatDate(qcds.updated_at)}` : "未登録"}</div>
                  </Link>
                  <Link href={`/projects/${id}/quote`} className="qlink">
                    <div className="ico">
                      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6M9 9h2" /></svg>
                    </div>
                    <div className="nm">見積書</div>
                    <div className="desc">顧客見積</div>
                    <div className="meta">{project.quote_count > 0 ? `${project.quote_count}件発行` : "未発行"}</div>
                  </Link>
                  <Link href={`/projects/${id}/order`} className="qlink">
                    <div className="ico">
                      <svg viewBox="0 0 24 24"><path d="M3 7h18l-2 12H5L3 7zM8 7V4h8v3" /></svg>
                    </div>
                    <div className="nm">注文書</div>
                    <div className="desc">発注管理</div>
                    <div className="meta">{project.order_count > 0 ? `${project.order_count}件` : "未発行"}</div>
                  </Link>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
    </AppShell>
  );
}
