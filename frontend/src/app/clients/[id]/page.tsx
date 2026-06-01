"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  ClientContactCreate,
  ClientContactRead,
  ClientDetail,
  ClientRank,
  ClientSiteCreate,
  ClientSiteRead,
  ClientUpdate,
} from "@/types/client";
import type { ProjectListItem, ProjectStatus } from "@/types/project";
import { PROJECT_STATUS_LABEL } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";

const RANK_COLOR: Record<ClientRank, { bg: string; text: string }> = {
  A: { bg: "color-mix(in oklab, var(--c-danger) 14%, var(--c-surface))", text: "var(--c-danger)" },
  B: { bg: "color-mix(in oklab, var(--c-warn) 14%, var(--c-surface))", text: "var(--c-warn)" },
  C: { bg: "var(--c-surface-2)", text: "var(--c-text-muted)" },
};

const STATUS_LABEL: Record<ProjectStatus, string> = PROJECT_STATUS_LABEL;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  quote:       "var(--c-status-quote)",
  ordered:     "var(--c-status-order)",
  started:     "var(--c-status-start)",
  in_progress: "var(--c-status-progress)",
  completed:   "var(--c-status-done)",
  billed:      "var(--c-status-billed)",
  paid:        "var(--c-status-paid)",
};

interface ProjectsResponse {
  items: ProjectListItem[];
  total: number;
}

/** 案件取得 (client_id フィルタ) */
async function fetchProjects(clientId: string): Promise<ProjectListItem[]> {
  const params = new URLSearchParams({ client_id: clientId, per_page: "200", page: "1" });
  const data = await apiFetch<ProjectsResponse>(`/api/v1/projects?${params}`);
  return data.items;
}

// ─── EditClientModal ────────────────────────────────────────────────────────

function EditClientModal({
  open, client, onClose, onSaved,
}: {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
  onSaved: (c: ClientDetail) => void;
}) {
  const [form, setForm] = useState<ClientUpdate>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        client_name: client.client_name,
        client_name_kana: client.client_name_kana,
        client_code: client.client_code,
        phone: client.phone,
        fax: client.fax,
        email: client.email,
        representative: client.representative,
        postal_code: client.postal_code,
        address: client.address,
        client_rank: client.client_rank,
        payment_condition_default: client.payment_condition_default,
        credit_limit: client.credit_limit,
        tax_id: client.tax_id,
        is_active: client.is_active,
        note: client.note,
      });
      setError(null);
    }
  }, [open, client]);

  const f = (field: keyof ClientUpdate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value || null }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name?.trim()) { setError("顧客名は必須です"); return; }
    setIsSubmitting(true); setError(null);
    try {
      const updated = await apiFetch<ClientDetail>(`/api/v1/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%", height: 32, padding: "0 8px", fontSize: 13,
    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
    background: "var(--c-surface)", color: "var(--c-text)", outline: "none",
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader><DialogTitle>顧客情報編集</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">顧客名 <span className="text-red-500">*</span></label>
              <Input value={form.client_name ?? ""} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">顧客名（カナ）</label>
              <Input value={form.client_name_kana ?? ""} onChange={f("client_name_kana")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">顧客コード</label>
              <Input value={form.client_code ?? ""} onChange={f("client_code")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">ランク</label>
              <select value={form.client_rank ?? ""} onChange={f("client_rank")} style={inputStyle}>
                <option value="">— 未設定 —</option>
                <option value="A">A（最優先）</option>
                <option value="B">B（優先）</option>
                <option value="C">C（標準）</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">電話番号</label>
              <Input value={form.phone ?? ""} onChange={f("phone")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">FAX</label>
              <Input value={form.fax ?? ""} onChange={f("fax")} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">メールアドレス</label>
            <Input value={form.email ?? ""} onChange={f("email")} type="email" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">代表者名</label>
            <Input value={form.representative ?? ""} onChange={f("representative")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">郵便番号</label>
              <Input value={form.postal_code ?? ""} onChange={f("postal_code")} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="block text-sm font-medium">住所</label>
              <Input value={form.address ?? ""} onChange={f("address")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">支払条件</label>
              <Input value={form.payment_condition_default ?? ""} onChange={f("payment_condition_default")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">登録番号（インボイス）</label>
              <Input value={form.tax_id ?? ""} onChange={f("tax_id")} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">備考</label>
            <textarea
              value={form.note ?? ""}
              onChange={f("note")}
              rows={3}
              style={{ ...inputStyle, height: "auto", padding: "6px 8px", resize: "vertical" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active ?? true}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
            />
            <label htmlFor="is_active" className="text-sm">有効</label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>キャンセル</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddSiteModal ────────────────────────────────────────────────────────────

function AddSiteModal({
  open, clientId, onClose, onAdded,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
  onAdded: (s: ClientSiteRead) => void;
}) {
  const [form, setForm] = useState<ClientSiteCreate>({ site_name: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setForm({ site_name: "" }); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const f = (field: keyof ClientSiteCreate) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value || null }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site_name.trim()) { setError("店舗名は必須です"); return; }
    setIsSubmitting(true); setError(null);
    try {
      const created = await apiFetch<ClientSiteRead>(`/api/v1/clients/${clientId}/sites`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      reset();
      onAdded(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader><DialogTitle>店舗・拠点追加</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">店舗名 <span className="text-red-500">*</span></label>
              <Input value={form.site_name} onChange={e => setForm(p => ({ ...p, site_name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">店舗コード</label>
              <div style={{ display: "flex", gap: 4 }}>
                <Input
                  value={form.site_code ?? ""}
                  onChange={f("site_code")}
                  placeholder="自動生成可"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = form.site_name.replace(/\s/g, "").slice(0, 3).toUpperCase();
                    setForm(p => ({ ...p, site_code: `${name}-${String(Date.now()).slice(-3)}` }));
                  }}
                  style={{
                    padding: "0 6px", fontSize: 11, whiteSpace: "nowrap",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                    background: "var(--c-surface-2)", color: "var(--c-text-muted)", cursor: "pointer",
                  }}
                >
                  自動
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">地域</label>
              <Input value={form.region ?? ""} onChange={f("region")} placeholder="例: 滋賀" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">担当者</label>
              <Input value={form.site_manager ?? ""} onChange={f("site_manager")} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium">電話番号</label>
            <Input value={form.site_phone ?? ""} onChange={f("site_phone")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">郵便番号</label>
              <Input value={form.postal_code ?? ""} onChange={f("postal_code")} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="block text-sm font-medium">住所</label>
              <Input value={form.address ?? ""} onChange={f("address")} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>キャンセル</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "追加中…" : "追加"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddContactModal ─────────────────────────────────────────────────────────

function AddContactModal({
  open, clientId, sites, representativeName, onClose, onAdded,
}: {
  open: boolean;
  clientId: string;
  sites: ClientSiteRead[];
  representativeName?: string;
  onClose: () => void;
  onAdded: (c: ClientContactRead) => void;
}) {
  const [form, setForm] = useState<ClientContactCreate>({ name: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => { setForm({ name: "" }); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const f = (field: keyof ClientContactCreate) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value || null }));

  const inputStyle = {
    width: "100%", height: 32, padding: "0 8px", fontSize: 13,
    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
    background: "var(--c-surface)", color: "var(--c-text)", outline: "none",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("氏名は必須です"); return; }
    setIsSubmitting(true); setError(null);
    try {
      const created = await apiFetch<ClientContactRead>(`/api/v1/clients/${clientId}/contacts`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      reset();
      onAdded(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader><DialogTitle>担当者追加</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          {/* 代表者と同じ引用ボタン */}
          {representativeName && (
            <div>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, name: representativeName, title: "代表取締役" }))}
                style={{
                  fontSize: 12, padding: "4px 10px",
                  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                  background: "var(--c-surface-2)", color: "var(--c-text-muted)",
                  cursor: "pointer", marginBottom: 8,
                }}
              >
                代表者「{representativeName}」と同じ
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">氏名 <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">氏名（カナ）</label>
              <Input value={form.name_kana ?? ""} onChange={f("name_kana")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">部署</label>
              <Input value={form.department ?? ""} onChange={f("department")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">役職</label>
              <Input value={form.title ?? ""} onChange={f("title")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">電話番号</label>
              <Input value={form.phone ?? ""} onChange={f("phone")} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">メールアドレス</label>
              <Input value={form.email ?? ""} onChange={f("email")} type="email" />
            </div>
          </div>
          {sites.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium">所属店舗</label>
              <select value={form.client_site_id ?? ""} onChange={f("client_site_id")} style={inputStyle}>
                <option value="">— 本社 / 未指定 —</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.site_name}{s.region ? ` (${s.region})` : ""}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={form.is_primary ?? false}
              onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))}
            />
            <label htmlFor="is_primary" className="text-sm">主担当</label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>キャンセル</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "追加中…" : "追加"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [sites, setSites] = useState<ClientSiteRead[]>([]);
  const [contacts, setContacts] = useState<ClientContactRead[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [projPage, setProjPage] = useState(1);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [detail, siteList, contactList, projectList] = await Promise.all([
        apiFetch<ClientDetail>(`/api/v1/clients/${id}`),
        apiFetch<ClientSiteRead[]>(`/api/v1/clients/${id}/sites`),
        apiFetch<ClientContactRead[]>(`/api/v1/clients/${id}/contacts`),
        fetchProjects(id).catch(() => [] as ProjectListItem[]),
      ]);
      setClient(detail);
      setSites(siteList);
      setContacts(contactList);
      setProjects(projectList);
    } catch {
      /* 401 → redirect */
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <AppShell breadcrumbs={[{ label: "顧客マスタ", href: "/clients" }, { label: "読み込み中…" }]}>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>読み込み中...</div>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell breadcrumbs={[{ label: "顧客マスタ", href: "/clients" }, { label: "不明" }]}>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)" }}>顧客が見つかりません</div>
      </AppShell>
    );
  }

  // 地域タブ
  const regions = Array.from(new Set(sites.map(s => s.region ?? "その他"))).sort();
  const filteredSites = activeRegion === "all" ? sites : sites.filter(s => (s.region ?? "その他") === activeRegion);

  const PER_PROJ = 20;
  const pagedProjects = projects.slice((projPage - 1) * PER_PROJ, projPage * PER_PROJ);
  const projPages = Math.max(1, Math.ceil(projects.length / PER_PROJ));

  const rankBadge = client.client_rank ? (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: "50%",
      fontSize: 11, fontWeight: 700,
      background: RANK_COLOR[client.client_rank].bg,
      color: RANK_COLOR[client.client_rank].text,
      marginLeft: 8,
    }}>
      {client.client_rank}
    </span>
  ) : null;

  return (
    <AppShell
      breadcrumbs={[{ label: "顧客マスタ", href: "/clients" }, { label: client.client_name }]}
      action={
        isAdmin ? (
          <Button variant="primary" onClick={() => setEditOpen(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            編集
          </Button>
        ) : undefined
      }
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="v-hero" style={{ gridTemplateColumns: "64px 1fr auto" }}>
        <div className="ic" style={client.client_rank ? {
          background: RANK_COLOR[client.client_rank].bg,
          color: RANK_COLOR[client.client_rank].text,
        } : {}}>
          {client.client_name.charAt(0)}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center" }}>
            {client.client_name}
            {rankBadge}
          </h1>
          {client.client_name_kana && <small style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{client.client_name_kana}</small>}
          {client.client_code && (
            <small style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-subtle)", display: "block" }}>
              {client.client_code}
            </small>
          )}
          <div style={{ marginTop: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "2px 8px", borderRadius: "var(--r-pill)",
              fontSize: 11, fontWeight: 600,
              background: client.is_active
                ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))"
                : "var(--c-surface-2)",
              color: client.is_active ? "var(--c-success)" : "var(--c-text-muted)",
            }}>
              {client.is_active ? "有効" : "無効"}
            </span>
          </div>
        </div>
        <div className="stat">
          <div>
            <div className="k">店舗数</div>
            <div className="v" style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700 }}>{client.site_count}</div>
          </div>
          <div>
            <div className="k">案件数</div>
            <div className="v" style={{ fontFamily: "var(--ff-mono)", fontSize: 22, fontWeight: 700 }}>{client.project_count}</div>
          </div>
          <div>
            <div className="k">登録日</div>
            <div className="v" style={{ fontFamily: "var(--ff-mono)", fontSize: 14, fontWeight: 600 }}>
              {new Date(client.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 基本情報 ──────────────────────────────────────────────── */}
      <div className="v-grid" style={{ marginBottom: 14 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)", fontWeight: 600, fontSize: 13 }}>
            基本情報
          </div>
          <div className="field-row">
            <div className="k">電話</div><div className="v">{client.phone ?? "—"}</div>
            <div className="k">FAX</div><div className="v">{client.fax ?? "—"}</div>
            <div className="k">メール</div><div className="v" style={{ wordBreak: "break-all" }}>{client.email ?? "—"}</div>
            <div className="k">代表者</div><div className="v">{client.representative ?? "—"}</div>
            <div className="k">住所</div>
            <div className="v" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              {client.postal_code && <span style={{ fontSize: 11, color: "var(--c-text-muted)" }}>〒{client.postal_code}</span>}
              <span>{client.address ?? "—"}</span>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)", fontWeight: 600, fontSize: 13 }}>
            取引情報
          </div>
          <div className="field-row">
            <div className="k">支払条件</div><div className="v">{client.payment_condition_default ?? "—"}</div>
            <div className="k">与信限度</div>
            <div className="v" style={{ fontFamily: "var(--ff-mono)" }}>
              {client.credit_limit != null ? `¥${client.credit_limit.toLocaleString()}` : "—"}
            </div>
            <div className="k">登録番号</div>
            <div className="v" style={{ fontFamily: "var(--ff-mono)", fontSize: 11 }}>{client.tax_id ?? "—"}</div>
            <div className="k">備考</div>
            <div className="v" style={{ whiteSpace: "pre-wrap", fontSize: 12, alignItems: "flex-start" }}>{client.note ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* ── 店舗一覧 ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid var(--c-border)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>店舗・拠点</span>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{sites.length}件</span>
          <span className="spacer" style={{ flex: 1 }} />
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAddSiteOpen(true)}>
              + 追加
            </button>
          )}
        </div>

        {/* 地域タブ */}
        {regions.length > 1 && (
          <div style={{
            display: "flex", gap: 4, padding: "8px 14px",
            borderBottom: "1px solid var(--c-border)", overflowX: "auto",
          }}>
            <button
              className={`pill${activeRegion === "all" ? " on" : ""}`}
              onClick={() => setActiveRegion("all")}
            >
              すべて ({sites.length})
            </button>
            {regions.map(r => (
              <button
                key={r}
                className={`pill${activeRegion === r ? " on" : ""}`}
                onClick={() => setActiveRegion(r)}
              >
                {r} ({sites.filter(s => (s.region ?? "その他") === r).length})
              </button>
            ))}
          </div>
        )}

        {filteredSites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
            店舗・拠点がまだありません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="vtbl">
              <thead>
                <tr>
                  <th>店舗名</th>
                  <th style={{ width: 80 }}>地域</th>
                  <th style={{ width: 130 }}>住所</th>
                  <th style={{ width: 120 }}>担当者</th>
                  <th style={{ width: 120 }}>電話</th>
                  <th style={{ width: 70 }}>コード</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map(s => (
                  <tr key={s.id} style={{ cursor: "default" }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.site_name}</div>
                    </td>
                    <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{s.region ?? "—"}</td>
                    <td style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                      {s.address ?? (s.postal_code ? `〒${s.postal_code}` : "—")}
                    </td>
                    <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{s.site_manager ?? "—"}</td>
                    <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{s.site_phone ?? "—"}</td>
                    <td style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--c-text-subtle)" }}>{s.site_code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 担当者一覧 ────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid var(--c-border)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>窓口担当者</span>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{contacts.length}名</span>
          <span style={{ flex: 1 }} />
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setAddContactOpen(true)}>
              + 追加
            </button>
          )}
        </div>
        {contacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
            担当者が登録されていません
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="vtbl">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th style={{ width: 100 }}>部署</th>
                  <th style={{ width: 90 }}>役職</th>
                  <th style={{ width: 120 }}>電話</th>
                  <th style={{ width: 160 }}>メール</th>
                  <th style={{ width: 100 }}>所属店舗</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => {
                  const siteName = sites.find(s => s.id === c.client_site_id)?.site_name;
                  return (
                    <tr key={c.id} style={{ cursor: "default" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
                            color: "var(--c-primary)", fontSize: 11, fontWeight: 700,
                            display: "grid", placeItems: "center", flexShrink: 0,
                          }}>
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>
                              {c.name}
                              {c.is_primary && (
                                <span style={{
                                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                                  color: "var(--c-primary)",
                                  background: "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
                                  padding: "1px 5px", borderRadius: "var(--r-pill)",
                                }}>主担当</span>
                              )}
                            </div>
                            {c.name_kana && <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{c.name_kana}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{c.department ?? "—"}</td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{c.title ?? "—"}</td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{c.phone ?? "—"}</td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 12, wordBreak: "break-all" }}>{c.email ?? "—"}</td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 11 }}>{siteName ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 案件一覧 ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid var(--c-border)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>関連案件</span>
          <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{projects.length}件</span>
        </div>
        {projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
            関連する案件がありません
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="vtbl">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>工事番号</th>
                    <th>件名</th>
                    <th style={{ width: 80, textAlign: "center" }}>ステータス</th>
                    <th style={{ width: 90 }}>受注区分</th>
                    <th className="num" style={{ width: 80 }}>登録日</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProjects.map(p => (
                    <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)}>
                      <td>
                        <a className="proj-link" href={`/projects/${p.id}`} onClick={e => e.preventDefault()}>
                          {p.project_number}
                        </a>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{p.project_name}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "2px 8px", borderRadius: "var(--r-pill)",
                          fontSize: 11, fontWeight: 600,
                          background: `color-mix(in oklab, ${STATUS_COLOR[p.status]} 15%, var(--c-surface))`,
                          color: STATUS_COLOR[p.status],
                        }}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td style={{ color: "var(--c-text-muted)", fontSize: 12 }}>{p.order_type === "private" ? "民間" : p.order_type === "government" ? "官庁" : "—"}</td>
                      <td className="num" style={{ color: "var(--c-text-muted)", fontSize: 11 }}>
                        {new Date(p.created_at).toLocaleDateString("ja-JP", { year: "2-digit", month: "numeric", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {projPages > 1 && (
              <div className="pagi">
                <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                  {(projPage - 1) * PER_PROJ + 1}–{Math.min(projPage * PER_PROJ, projects.length)} / {projects.length}件
                </span>
                <span style={{ flex: 1 }} />
                <button disabled={projPage <= 1} onClick={() => setProjPage(p => p - 1)}>‹</button>
                {Array.from({ length: projPages }, (_, i) => i + 1).map(n => (
                  <Fragment key={n}>
                    <button className={projPage === n ? "on" : ""} onClick={() => setProjPage(n)}>{n}</button>
                  </Fragment>
                ))}
                <button disabled={projPage >= projPages} onClick={() => setProjPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <EditClientModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={updated => { setClient(updated); setEditOpen(false); }}
      />
      <AddSiteModal
        open={addSiteOpen}
        clientId={id}
        onClose={() => setAddSiteOpen(false)}
        onAdded={s => { setSites(prev => [...prev, s]); setAddSiteOpen(false); }}
      />
      <AddContactModal
        open={addContactOpen}
        clientId={id}
        sites={sites}
        representativeName={client?.representative ?? ""}
        onClose={() => setAddContactOpen(false)}
        onAdded={c => { setContacts(prev => [...prev, c]); setAddContactOpen(false); }}
      />
    </AppShell>
  );
}
