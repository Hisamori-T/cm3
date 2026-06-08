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

// ─── 工事台帳 承認型 ─────────────────────────────────────────────────────────

interface LedgerApproval {
  id: string;
  role_label: string;
  approver_id: string | null;
  approver_name: string | null;
  approved_at: string | null;
  approver_user_id: string | null;
  approver_user_name: string | null;
  requested_by_name: string | null;
  requested_at: string | null;
  display_order: number;
}

interface LedgerDirectWork {
  id: string;
  row_no: number;
  vendor_name: string | null;
  work_type: string | null;
  budget_amount: number | null;
  agreed_amount: number | null;
  settlement_amount: number | null;
  payment_completed: boolean;
  monthly_payments: Record<string, number | null>;
  note: string | null;
}

interface LedgerSummary {
  approvals: LedgerApproval[];
  project_price: number | null;
  direct_works: LedgerDirectWork[];
}

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
  // 工事台帳承認 state
  const [ledgerApprovals, setLedgerApprovals] = useState<LedgerApproval[]>([]);
  const [ledgerWorks, setLedgerWorks] = useState<LedgerDirectWork[]>([]);
  const [requestModal, setRequestModal] = useState<{ role_label: string } | null>(null);
  const [requestUserId, setRequestUserId] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  // 精算見通表の支払開始月（デフォルト: 4月）
  const [payStartMonth, setPayStartMonth] = useState<number>(4);
  // 税込/税抜 表示切替（実行予算・取決金額・取決差額に適用）
  const [showTaxInclusive, setShowTaxInclusive] = useState<boolean>(false);
  const TAX = 1.1;
  const applyTax = (v: number | null | undefined) =>
    v != null ? (showTaxInclusive ? Math.round(v * TAX) : v) : null;
  // 月別支払インライン編集
  const [editingPayCell, setEditingPayCell] = useState<{ workId: string; month: number } | null>(null);
  const [editingPayValue, setEditingPayValue] = useState("");
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

  const fetchLedger = useCallback(async () => {
    try {
      const data = await apiFetch<LedgerSummary>(`/api/v1/projects/${id}/ledger`);
      setLedgerApprovals(data.approvals.sort((a, b) => a.display_order - b.display_order));
      setLedgerWorks(data.direct_works ?? []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchApprovals = useCallback(async () => {
    try {
      const data = await apiFetch<{ pending: ApprovalRequest[]; requested_by_me: ApprovalRequest[] }>("/api/v1/approvals/my");
      const all = [...(data.pending ?? []), ...(data.requested_by_me ?? [])];
      const forThis = all.filter(a => a.quote_number?.startsWith((id ?? "").slice(0, 8)));
      setApprovalRequests(forThis);
    } catch { /* ignore */ }
  }, [id]);

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
      fetchLedger();
      fetchApprovals();
      apiFetch<{ id: string; full_name: string }[]>("/api/v1/auth/users")
        .then(setUsers)
        .catch(() => {});
    }
  }, [authLoading, user, fetchProject, fetchQcds, fetchQuoteSubtotal, fetchLedger, fetchApprovals]);

  // 工事台帳 押印依頼ハンドラ
  const handleRequestApproval = async () => {
    if (!requestModal || !requestUserId) return;
    setRequestSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${id}/ledger/request-approve`, {
        method: "POST",
        body: JSON.stringify({ role_label: requestModal.role_label, approver_user_id: requestUserId }),
      });
      setRequestModal(null);
      setRequestUserId("");
      fetchLedger();
    } catch { /* ignore */ } finally {
      setRequestSaving(false);
    }
  };

  const handleRevokeApproval = async (role_label: string) => {
    try {
      await apiFetch(`/api/v1/projects/${id}/ledger/approve/${encodeURIComponent(role_label)}`, { method: "DELETE" });
      fetchLedger();
    } catch { /* ignore */ }
  };

  // 工事台帳 押印（承認依頼を受けた当人が押印）
  const handleApproveStamp = async (role_label: string) => {
    try {
      await apiFetch(`/api/v1/projects/${id}/ledger/approve`, {
        method: "POST",
        body: JSON.stringify({ role_label }),
      });
      fetchLedger();
    } catch { /* ignore */ }
  };

  // 月別支払セル保存
  const savePayCell = async (workId: string, month: number, value: string) => {
    const numVal = value === "" ? null : Number(value.replace(/,/g, ""));
    const key = `payment_month_${month}`;
    try {
      await apiFetch(`/api/v1/projects/${id}/ledger/direct-works/${workId}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: numVal }),
      });
      fetchLedger();
    } catch { /* ignore */ }
    setEditingPayCell(null);
  };

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
  const userRoles = (user as { roles?: string[] })?.roles ?? [user?.role ?? ""];
  const canEdit = ["admin", "super_admin", "manager"].some(r => userRoles.includes(r)) || (user && project && user.id === project.created_by);

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
    <>
    {/* 押印依頼モーダル */}
    {requestModal && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--c-surface)", borderRadius: "var(--r-lg)", padding: 24, width: 440, boxShadow: "var(--sh-3)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>押印依頼 — {requestModal.role_label}</h3>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", display: "block", marginBottom: 6 }}>依頼先ユーザー</label>
          <select className="input" style={{ width: "100%" }} value={requestUserId} onChange={e => setRequestUserId(e.target.value)}>
            <option value="">選択してください</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button className="btn" onClick={() => { setRequestModal(null); setRequestUserId(""); }}>キャンセル</button>
            <button className="btn btn-primary" onClick={handleRequestApproval} disabled={!requestUserId || requestSaving}>
              {requestSaving ? "送信中..." : "依頼を送る"}
            </button>
          </div>
        </div>
      </div>
    )}
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

              {/* 工事台帳 承認スタンプ（印影プレビュースタイル） */}
              {ledgerApprovals.length > 0 && (
                <div style={{ padding: 14, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-lg)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                    工事台帳 承認 — {ledgerApprovals.filter(a => a.approved_at).length}/{ledgerApprovals.length} 完了
                  </div>
                  {/* スタンプグリッド */}
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${ledgerApprovals.length}, 1fr)`, border: "1px solid #999" }}>
                    {ledgerApprovals.map((a, i) => {
                      const isStamped = !!a.approved_at;
                      const isPending = !isStamped && !!a.approver_user_id;
                      const lastName = a.approver_name?.split(" ")[0] ?? "";
                      return (
                        <div key={a.id} style={{ borderRight: i < ledgerApprovals.length - 1 ? "1px solid #999" : "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          {/* ロール行 */}
                          <div style={{ width: "100%", borderBottom: "1px solid #999", textAlign: "center", padding: "4px 2px", fontSize: 10, fontWeight: 600, color: "var(--c-text-muted)", background: "var(--c-surface-2)" }}>
                            {a.role_label}
                          </div>
                          {/* スタンプ本体 */}
                          <div style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 80, justifyContent: "center" }}>
                            {isStamped ? (
                              <>
                                <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px solid #C00000", color: "#C00000", display: "grid", placeItems: "center", fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif', fontWeight: 700, fontSize: 13, writingMode: "vertical-rl", letterSpacing: 1 }}>
                                  {lastName || "✓"}
                                </div>
                                <div style={{ fontSize: 9, color: "var(--c-text-muted)", textAlign: "center" }}>{new Date(a.approved_at!).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</div>
                                {canEdit && <button className="btn btn-ghost" style={{ fontSize: 9, padding: "1px 6px", marginTop: 2 }} onClick={() => handleRevokeApproval(a.role_label)}>取消</button>}
                              </>
                            ) : isPending ? (
                              <>
                                <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px dashed var(--c-warn)", display: "grid", placeItems: "center" }}>
                                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-warn)" }} />
                                </div>
                                <div style={{ fontSize: 9, color: "var(--c-warn)", textAlign: "center", fontWeight: 600 }}>{a.approver_user_name}</div>
                                {/* 自分が押印対象なら押印ボタンを表示 */}
                                {user?.id === a.approver_user_id ? (
                                  <button
                                    className="btn btn-primary"
                                    style={{ fontSize: 9, padding: "3px 8px", marginTop: 2, background: "#C00000", border: "none" }}
                                    onClick={() => handleApproveStamp(a.role_label)}
                                  >
                                    押印する
                                  </button>
                                ) : (
                                  <div style={{ fontSize: 9, color: "var(--c-warn)" }}>承認待ち</div>
                                )}
                              </>
                            ) : (
                              <>
                                <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px dashed var(--c-border)", display: "grid", placeItems: "center", color: "var(--c-text-subtle)", fontSize: 10 }}>未</div>
                                {canEdit && (
                                  <button className="btn btn-primary" style={{ fontSize: 9, padding: "2px 8px", marginTop: 2 }}
                                    onClick={() => { setRequestModal({ role_label: a.role_label }); setRequestUserId(""); }}>
                                    押印依頼
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

          {/* ===== 取決見通表（vtbl）全幅 ===== */}
          {ledgerWorks.length > 0 && (() => {
            // 支払開始月から12ヶ月順に並べる（会計年度4月始まり）
            const months: number[] = [];
            for (let i = 0; i < 12; i++) {
              months.push(((payStartMonth - 1 + i) % 12) + 1);
            }
            const totalBudget = ledgerWorks.reduce((s, w) => s + (applyTax(w.budget_amount) ?? 0), 0);
            const totalAgreed = ledgerWorks.reduce((s, w) => s + (applyTax(w.agreed_amount) ?? 0), 0);
            const monthTotals = months.map(m =>
              ledgerWorks.reduce((s, w) => s + (w.monthly_payments?.[String(m)] ?? 0), 0)
            );
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>実行予算 / 取決見通 / 精算(支払)見通</h3>
                  <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>※ 取決金額は発注書合計（発行済以降）と自動連動</span>
                  {/* 税込/税抜 トグルスイッチ */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                    <span style={{ fontSize: 11, color: showTaxInclusive ? "var(--c-text-muted)" : "var(--c-primary)", fontWeight: showTaxInclusive ? 400 : 700 }}>税抜</span>
                    <button
                      onClick={() => setShowTaxInclusive(v => !v)}
                      style={{
                        width: 40, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                        background: showTaxInclusive ? "var(--c-primary)" : "var(--c-border)",
                        position: "relative", transition: "background 0.2s", padding: 0, flexShrink: 0,
                      }}
                      title={showTaxInclusive ? "税込表示（クリックで税抜に切替）" : "税抜表示（クリックで税込に切替）"}
                    >
                      <span style={{
                        position: "absolute", top: 2, left: showTaxInclusive ? 22 : 2,
                        width: 16, height: 16, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                      }} />
                    </button>
                    <span style={{ fontSize: 11, color: showTaxInclusive ? "var(--c-primary)" : "var(--c-text-muted)", fontWeight: showTaxInclusive ? 700 : 400 }}>税込</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await apiFetch<{ synced_vendors: number; message: string }>(
                          `/api/v1/projects/${id}/qcds/sync-from-orders`,
                          { method: "POST" }
                        );
                        await fetchLedger();
                        alert(res.message);
                      } catch { alert("再同期に失敗しました"); }
                    }}
                    style={{
                      marginLeft: "auto", fontSize: 11, padding: "3px 10px",
                      border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                      background: "var(--c-surface-2)", cursor: "pointer",
                      color: "var(--c-primary)", display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    🔄 発注書から再同期
                  </button>
                </div>
                <div style={{ overflowX: "auto", width: "100%" }}>
                  <table className="vtbl" style={{ width: "100%", minWidth: "unset", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ background: "var(--c-surface-2)", padding: "7px 8px", textAlign: "left", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 32, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>No</th>
                        <th style={{ background: "var(--c-surface-2)", padding: "7px 8px", textAlign: "left", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", minWidth: 120, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>支払先</th>
                        <th style={{ background: "var(--c-surface-2)", padding: "7px 8px", textAlign: "left", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 80, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>工種</th>
                        <th style={{ background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface-2))", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 90, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>実行予算{showTaxInclusive ? "（税込）" : ""}</th>
                        <th style={{ background: "color-mix(in oklab, var(--c-warn) 10%, var(--c-surface-2))", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 90, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>取決金額{showTaxInclusive ? "（税込）" : ""}</th>
                        <th style={{ background: "color-mix(in oklab, var(--c-warn) 10%, var(--c-surface-2))", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 80, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>取決差額</th>
                        {/* 月列ヘッダー: 先頭に支払開始月ドロップダウン */}
                        <th colSpan={12} style={{ background: "color-mix(in oklab, var(--c-status-progress) 10%, var(--c-surface-2))", padding: "4px 8px", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>精算(支払)見通</span>
                            <select
                              value={payStartMonth}
                              onChange={e => setPayStartMonth(Number(e.target.value))}
                              style={{ fontSize: 10, padding: "1px 4px", border: "1px solid var(--c-border)", borderRadius: 3, background: "var(--c-surface)", cursor: "pointer" }}
                            >
                              {[4,5,6,7,8,9,10,11,12,1,2,3].map(m => (
                                <option key={m} value={m}>{m}月〜</option>
                              ))}
                            </select>
                          </div>
                        </th>
                        <th style={{ background: "color-mix(in oklab, var(--c-status-progress) 10%, var(--c-surface-2))", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 80, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>支払計</th>
                        <th style={{ background: "color-mix(in oklab, var(--c-status-progress) 10%, var(--c-surface-2))", padding: "7px 8px", textAlign: "right", borderBottom: "1px solid var(--c-border)", color: "var(--c-text-muted)", fontWeight: 600, fontSize: 11 }}>残支払</th>
                      </tr>
                      {/* 月ラベル行 */}
                      <tr>
                        <td colSpan={6} style={{ background: "var(--c-surface-2)", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)" }} />
                        {months.map(m => (
                          <th key={m} style={{ background: "color-mix(in oklab, var(--c-status-progress) 10%, var(--c-surface-2))", padding: "4px 6px", textAlign: "right", borderBottom: "1px solid var(--c-border)", borderRight: "1px solid var(--c-border)", width: 66, color: "var(--c-text-muted)", fontWeight: 600, fontSize: 10 }}>{m}月</th>
                        ))}
                        <td colSpan={2} style={{ background: "color-mix(in oklab, var(--c-status-progress) 10%, var(--c-surface-2))", borderBottom: "1px solid var(--c-border)" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerWorks.map((w, idx) => {
                        const dispBudget = applyTax(w.budget_amount);
                        const dispAgreed = applyTax(w.agreed_amount);
                        const diff = (dispBudget ?? 0) - (dispAgreed ?? 0);
                        const paySum = months.reduce((s, m) => s + (w.monthly_payments?.[String(m)] ?? 0), 0);
                        const remaining = (w.agreed_amount ?? 0) - paySum;
                        // 取決金額が設定されている場合のみ「済」判定（税抜ベースで判定）
                        const isDone = w.agreed_amount != null && w.agreed_amount > 0
                          && (w.payment_completed || (paySum > 0 && remaining <= 0));
                        return (
                          <tr key={w.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                            <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "var(--ff-mono)", color: "var(--c-text-muted)", borderRight: "1px solid var(--c-border)", background: "var(--c-surface)" }}>{idx + 1}</td>
                            <td style={{ padding: "6px 8px", borderRight: "1px solid var(--c-border)", background: "var(--c-surface)", fontWeight: 500 }}>{w.vendor_name ?? "—"}</td>
                            <td style={{ padding: "6px 8px", borderRight: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text-muted)", fontSize: 11 }}>{w.work_type ?? "—"}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)", background: "color-mix(in oklab, var(--c-primary) 4%, var(--c-surface))" }}>{dispBudget != null ? fmtYen(dispBudget) : "—"}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)", background: "color-mix(in oklab, var(--c-warn) 4%, var(--c-surface))" }}>{dispAgreed != null ? fmtYen(dispAgreed) : "—"}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)", background: "var(--c-surface)", color: diff > 0 ? "var(--c-success)" : diff < 0 ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                              {dispBudget != null && dispAgreed != null ? fmtYen(diff) : "—"}
                            </td>
                            {months.map(m => {
                              const val = w.monthly_payments?.[String(m)];
                              const isEditing = editingPayCell?.workId === w.id && editingPayCell?.month === m;
                              return (
                                <td
                                  key={m}
                                  onClick={() => {
                                    if (!isEditing) {
                                      setEditingPayCell({ workId: w.id, month: m });
                                      setEditingPayValue(val != null ? String(val) : "");
                                    }
                                  }}
                                  style={{
                                    padding: isEditing ? "2px 4px" : "6px 6px",
                                    textAlign: "right",
                                    fontFamily: "var(--ff-mono)",
                                    borderRight: "1px solid var(--c-border)",
                                    background: isEditing ? "var(--c-primary-50)" : "var(--c-surface)",
                                    color: val ? "var(--c-text)" : "var(--c-text-subtle)",
                                    fontSize: 11,
                                    cursor: "text",
                                    outline: isEditing ? "2px solid var(--c-primary)" : "none",
                                    outlineOffset: -1,
                                    minWidth: 60,
                                  }}
                                >
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      type="number"
                                      value={editingPayValue}
                                      onChange={e => setEditingPayValue(e.target.value)}
                                      onBlur={() => savePayCell(w.id, m, editingPayValue)}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") savePayCell(w.id, m, editingPayValue);
                                        if (e.key === "Escape") setEditingPayCell(null);
                                      }}
                                      style={{
                                        width: "100%", border: "none", background: "transparent",
                                        fontFamily: "var(--ff-mono)", fontSize: 11,
                                        textAlign: "right", outline: "none",
                                      }}
                                    />
                                  ) : (
                                    val ? fmtYen(val) : <span style={{ color: "var(--c-border)", userSelect: "none" }}>—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)", background: "color-mix(in oklab, var(--c-primary) 4%, var(--c-surface))", fontWeight: 700 }}>
                              {fmtYen(paySum)}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", background: isDone ? "color-mix(in oklab, var(--c-success) 8%, var(--c-surface))" : "var(--c-surface)", fontWeight: isDone ? 700 : 400, color: isDone ? "var(--c-success)" : "var(--c-text)" }}>
                              {isDone ? "済" : w.agreed_amount != null ? fmtYen(Math.max(0, remaining)) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))", fontWeight: 700, borderTop: "1.5px solid var(--c-border)" }}>
                        <td colSpan={3} style={{ padding: "7px 8px", borderRight: "1px solid var(--c-border)", fontSize: 12 }}>直接工事費 計</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)" }}>{fmtYen(totalBudget)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)" }}>{fmtYen(totalAgreed)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)" }}>{fmtYen(totalBudget - totalAgreed)}</td>
                        {monthTotals.map((t, i) => (
                          <td key={i} style={{ padding: "7px 6px", textAlign: "right", fontFamily: "var(--ff-mono)", borderRight: "1px solid var(--c-border)", fontSize: 11 }}>{t ? fmtYen(t) : "—"}</td>
                        ))}
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

        </div>
      )}
    </AppShell>
    </>
  );
}
