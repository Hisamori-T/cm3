"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ProjectDetail, ProjectRole, ProjectStatus, ProjectUpdate } from "@/types/project";
import { PROJECT_ROLE_COLOR, PROJECT_ROLE_LABEL, PROJECT_STATUS_LABEL } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteSearch } from "@/components/client/SiteSearch";
import type { SiteSearchValue } from "@/components/client/SiteSearch";
import { fmtYen } from "@/lib/format";
import { EditField } from "@/modules/project/EditField";
import { EditSelect } from "@/modules/project/EditSelect";

// 見積書承認ステータス
interface ApprovalStep {
  id: string;
  step_no: number;
  approver_id: string;
  approver_name?: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  decided_at: string | null;
}
interface ApprovalRequest {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  steps: ApprovalStep[];
  quote_number?: string;
}

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

/** 案件詳細画面（S04）。 */
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [quoteSubtotal, setQuoteSubtotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectUpdate>({});
  const [siteSearch, setSiteSearch] = useState<SiteSearchValue>({ clientId: null, clientName: "", siteId: null, siteName: null });
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  // 見積書承認ステータス state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);

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

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await apiFetch<{ pending: ApprovalRequest[]; requested_by_me: ApprovalRequest[] }>("/api/v1/approvals/my");
      const all = [...(data.pending ?? []), ...(data.requested_by_me ?? [])];
      const forThis = all.filter(a => a.quote_number?.startsWith((id ?? "").slice(0, 8)));
      setApprovalRequests(forThis);
    } catch { /* ignore */ }
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
      fetchQuoteSubtotal();
      fetchApprovals();
      apiFetch<{ id: string; full_name: string }[]>("/api/v1/auth/users")
        .then(setUsers)
        .catch(() => {});
    }
  }, [authLoading, user, fetchProject, fetchQuoteSubtotal, fetchApprovals]);

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
      project_location: project.project_location ?? "",
      project_role: project.project_role ?? undefined,
      project_summary: project.project_summary ?? "",
      client_contact_company: project.client_contact_company ?? "",
      client_contact_person: project.client_contact_person ?? "",
      client_contact_phone: project.client_contact_phone ?? "",
      project_price: project.project_price ?? undefined,
      period_quote_start: project.period_quote_start ?? "",
      period_quote_end: project.period_quote_end ?? "",
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
  const userRoles = (user as { roles?: string[] })?.roles ?? [user?.role ?? ""];
  const canEdit = ["admin", "super_admin", "manager"].some(r => userRoles.includes(r)) || (user && project && user.id === project.created_by);

  return (
    <AppShell
      breadcrumbs={[
        { label: "案件一覧", href: "/projects" },
        { label: project?.project_number ?? "…" },
      ]}
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
                      <EditField label="件名" value={f("project_name")} onChange={set("project_name")} />
                      <EditField label="工事番号" value={f("project_number")} onChange={set("project_number")} />
                      <EditField label="案件場所" value={f("project_location")} onChange={set("project_location")} />
                      <div className="k" style={{ alignSelf: "flex-start", paddingTop: 8 }}>顧客</div>
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
                      <EditSelect label="案件立場" value={f("project_role")} options={[{ value: "prime", label: "元請" }, { value: "sub", label: "下請" }]} onChange={set("project_role")} />
                      <EditField label="工事価格" value={f("project_price")} onChange={set("project_price")} type="number" />
                      <EditField label="予定工期 開始" value={f("period_quote_start")} onChange={set("period_quote_start")} type="date" />
                      <EditField label="予定工期 終了" value={f("period_quote_end")} onChange={set("period_quote_end")} type="date" />
                      <EditField label="案件概要" value={f("project_summary")} onChange={set("project_summary")} />
                    </>
                  ) : (
                    <>
                      <div className="k">件名</div>
                      <div className="v">{project.project_name}</div>

                      <div className="k">案件場所</div>
                      <div className="v">{project.project_location ?? "—"}</div>

                      <div className="k">顧客</div>
                      <div className="v">
                        {project.client_id ? (
                          <Link href={`/clients/${project.client_id}`} style={{ color: "var(--c-primary)", textDecoration: "none", fontWeight: 500 }}>
                            {project.client_name ?? "—"}
                          </Link>
                        ) : (project.client_name ?? "—")}
                      </div>

                      <div className="k">予定工期</div>
                      <div className="v">
                        {(project.period_quote_start || project.period_quote_end)
                          ? <><span className="num">{project.period_quote_start ?? "—"}</span> 〜 <span className="num">{project.period_quote_end ?? "—"}</span></>
                          : "—"}
                      </div>

                      <div className="k">案件立場</div>
                      <div className="v">
                        {project.project_role ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: `color-mix(in oklab, ${PROJECT_ROLE_COLOR[project.project_role as ProjectRole]} 12%, var(--c-surface))`,
                            color: PROJECT_ROLE_COLOR[project.project_role as ProjectRole],
                            border: `1px solid color-mix(in oklab, ${PROJECT_ROLE_COLOR[project.project_role as ProjectRole]} 30%, var(--c-border))`,
                          }}>
                            {PROJECT_ROLE_LABEL[project.project_role as ProjectRole]}
                          </span>
                        ) : <span style={{ color: "var(--c-text-muted)" }}>—</span>}
                      </div>

                      <div className="k">案件概要</div>
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
                {/* 見積書 承認ステータス ミニパネル */}
                {approvalRequests.length > 0 && (() => {
                  const req = approvalRequests[0];
                  const done = req.steps.filter(s => s.status === "approved").length;
                  const total = req.steps.length;
                  return (
                    <div style={{ padding: "12px 14px", borderTop: "1px solid var(--c-border)", background: "color-mix(in oklab, var(--c-warn) 6%, var(--c-surface))" }}>
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-warn)" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                        見積書 承認ステータス · {done}/{total} 完了
                      </div>
                      {req.steps.map((step, i) => (
                        <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12 }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: "50%",
                            border: step.status === "approved" ? "none" : `1.5px solid ${step.status === "pending" ? "var(--c-warn)" : "var(--c-border)"}`,
                            background: step.status === "approved" ? "var(--c-success)" : "var(--c-surface)",
                            display: "grid", placeItems: "center", flexShrink: 0,
                          }}>
                            {step.status === "approved" && <div style={{ width: 4, height: 7, borderRight: "1.5px solid #fff", borderBottom: "1.5px solid #fff", transform: "rotate(45deg)" }} />}
                            {step.status === "pending" && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-warn)" }} />}
                          </div>
                          <span style={{ color: "var(--c-text-muted)" }}>Step {step.step_no}</span>
                          <span style={{ fontWeight: 600 }}>{(step as { approver_name?: string }).approver_name ?? "—"}</span>
                          <span style={{ marginLeft: "auto", fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--c-text-muted)" }}>
                            {step.status === "approved" && step.decided_at ? new Date(step.decided_at).toLocaleDateString("ja-JP") : step.status === "pending" ? "承認待ち" : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>

        </div>
      )}
    </AppShell>
  );
}
