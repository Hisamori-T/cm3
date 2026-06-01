"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PriceHistoryListResponse, PriceHistoryRead, VendorDetail, VendorUpdate } from "@/types/vendor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SOURCE_LABEL: Record<string, string> = {
  scan: "スキャン",
  manual: "手動",
  import: "インポート",
};

/** 前回比計算 */
function calcDelta(current: PriceHistoryRead, histories: PriceHistoryRead[]): { cls: string; label: string } | null {
  const same = histories.filter(
    h => h.id !== current.id
      && h.item_name === current.item_name
      && h.item_spec === current.item_spec
      && (h.quoted_at ?? "") < (current.quoted_at ?? "Z"),
  ).sort((a, b) => (b.quoted_at ?? "").localeCompare(a.quoted_at ?? ""));
  const prev = same[0];
  if (!prev || prev.unit_price == null || current.unit_price == null) return null;
  const pct = ((current.unit_price - prev.unit_price) / prev.unit_price) * 100;
  if (Math.abs(pct) < 0.5) return { cls: "delta-flat", label: "フラット" };
  if (pct > 0) return { cls: "delta-up", label: `▲ +${pct.toFixed(1)}%` };
  return { cls: "delta-down", label: `▼ ${pct.toFixed(1)}%` };
}

/** 単価推移SVGラインチャート */
function PriceLineChart({ histories }: { histories: PriceHistoryRead[] }) {
  const candidates = [...histories]
    .filter(h => h.unit_price != null)
    .sort((a, b) => (a.quoted_at ?? "").localeCompare(b.quoted_at ?? ""));
  if (candidates.length < 2) return null;

  // 最も多く登場する item_name で絞り込む
  const nameCounts: Record<string, number> = {};
  for (const h of candidates) nameCounts[h.item_name] = (nameCounts[h.item_name] ?? 0) + 1;
  const topName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0][0];
  const pts = candidates.filter(h => h.item_name === topName && h.unit_price != null);
  if (pts.length < 2) return null;

  const prices = pts.map(h => h.unit_price as number);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const W = 600, H = 160, PX = 40, PY = 20, CW = W - PX * 2, CH = H - PY * 2;
  const cx = (i: number) => PX + (i / (pts.length - 1)) * CW;
  const cy = (v: number) => PY + CH - ((v - minP) / range) * CH;

  const polyPts = pts.map((h, i) => `${cx(i)},${cy(h.unit_price as number)}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div className="price-chart">
      <div className="head">
        <div>
          <div className="ttl">単価推移 — {topName}</div>
          <div style={{ fontSize: 11, color: "var(--c-text-muted)" }}>¥ · {pts.length}件</div>
        </div>
        <div className="meta">
          直近:{" "}
          <strong style={{ color: "var(--c-text)", fontFamily: "var(--ff-mono)", fontSize: 13, fontWeight: 700 }}>
            ¥{(last.unit_price as number).toLocaleString()}
          </strong>
          {last.unit ?? ""}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }}>
        <g stroke="var(--c-border)" strokeDasharray="2 3" strokeWidth="0.5">
          {[0, 0.33, 0.67, 1].map((t, i) => (
            <line key={i} x1={PX} y1={PY + t * CH} x2={W - PX} y2={PY + t * CH} />
          ))}
        </g>
        <path
          d={`M${pts.map((h, i) => `${cx(i)},${cy(h.unit_price as number)}`).join(" L")} L${cx(pts.length - 1)},${PY + CH} L${cx(0)},${PY + CH} Z`}
          fill="var(--c-primary)" opacity={0.08}
        />
        <polyline points={polyPts} stroke="var(--c-primary)" strokeWidth="2" fill="none" />
        {pts.map((h, i) => (
          <circle key={i} cx={cx(i)} cy={cy(h.unit_price as number)} r={i === pts.length - 1 ? 4 : 3}
            fill="var(--c-primary)"
            stroke={i === pts.length - 1 ? "var(--c-surface)" : undefined}
            strokeWidth={i === pts.length - 1 ? 2 : undefined}
          />
        ))}
        <g fontSize="9" fill="var(--c-text-subtle)" fontFamily="monospace" textAnchor="middle">
          {pts.filter((_, i) => i === 0 || i === pts.length - 1 || pts.length <= 5).map((h, i) => (
            h.quoted_at && (
              <text key={i} x={cx(pts.indexOf(h))} y={H - 2}>
                {h.quoted_at.slice(0, 7)}
              </text>
            )
          ))}
        </g>
      </svg>
    </div>
  );
}

/** 業者詳細画面 (S14). */
export default function VendorDetailPage() {
  const { id: vendorId } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<VendorUpdate>({});
  const [workTypeInput, setWorkTypeInput] = useState("");

  const [histories, setHistories] = useState<PriceHistoryRead[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histQ, setHistQ] = useState("");
  const [histLoading, setHistLoading] = useState(false);
  const HIST_PER_PAGE = 20;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVendor = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<VendorDetail>(`/api/v1/vendors/${vendorId}`);
      setVendor(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  const fetchHistory = useCallback(async (q: string, p: number) => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(HIST_PER_PAGE), ...(q && { q }) });
      const data = await apiFetch<PriceHistoryListResponse>(`/api/v1/vendors/${vendorId}/price-history?${params}`);
      setHistories(data.items);
      setHistTotal(data.total);
    } catch {
      // 履歴取得失敗は無視
    } finally {
      setHistLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { fetchHistory(histQ, histPage); }, [fetchHistory, histQ, histPage]);

  const handleHistSearch = (v: string) => {
    setHistQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setHistPage(1); }, 0);
  };

  const startEdit = () => {
    if (!vendor) return;
    setForm({
      vendor_name: vendor.vendor_name,
      vendor_name_kana: vendor.vendor_name_kana,
      postal_code: vendor.postal_code,
      address: vendor.address,
      phone: vendor.phone,
      email: vendor.email,
      contact_person: vendor.contact_person,
      bank_info: vendor.bank_info,
      note: vendor.note,
      is_active: vendor.is_active,
    });
    setWorkTypeInput(vendor.primary_work_types?.join(", ") ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const workTypes = workTypeInput.trim()
        ? workTypeInput.split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean)
        : null;
      const updated = await apiFetch<VendorDetail>(`/api/v1/vendors/${vendorId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, primary_work_types: workTypes }),
      });
      setVendor(updated);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const histTotalPages = Math.max(1, Math.ceil(histTotal / HIST_PER_PAGE));

  if (isLoading || authLoading) {
    return (
      <AppShell breadcrumbs={[{ label: "業者マスタ", href: "/vendors" }, { label: "…" }]}>
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--c-text-muted)", fontSize: 13 }}>
          読み込み中…
        </div>
      </AppShell>
    );
  }

  if (!vendor) {
    return (
      <AppShell breadcrumbs={[{ label: "業者マスタ", href: "/vendors" }, { label: "見つかりません" }]}>
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ color: "var(--c-text-muted)", marginBottom: 12 }}>業者が見つかりません</p>
          <Link href="/vendors" style={{ color: "var(--c-primary)", fontSize: 13 }}>← 業者一覧</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: "業者マスタ", href: "/vendors" },
        { label: vendor.vendor_name },
      ]}
      action={
        isAdmin && !isEditing ? (
          <Button variant="primary" size="sm" onClick={startEdit}>編集</Button>
        ) : isEditing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
              キャンセル
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中…" : "保存"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13, marginBottom: 12,
          background: "var(--c-danger-bg)",
          border: "1px solid color-mix(in oklab, var(--c-danger) 30%, var(--c-border))",
          color: "var(--c-danger)",
        }}>
          {error}
        </div>
      )}

      {/* Hero */}
      <div className="v-hero">
        <div className="ic">{vendor.vendor_name.charAt(0)}</div>
        <div>
          <h1>
            {vendor.vendor_name}
            <small>
              {vendor.contact_person && `担当: ${vendor.contact_person}`}
              {vendor.contact_person && vendor.created_at && " · "}
              {vendor.created_at && `登録 ${new Date(vendor.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })}`}
            </small>
          </h1>
          {vendor.primary_work_types && vendor.primary_work_types.length > 0 && (
            <div className="trade-chips">
              {vendor.primary_work_types.map(w => (
                <span key={w} className="trade-chip">{w}</span>
              ))}
            </div>
          )}
        </div>
        <div className="stat">
          <div>
            <div className="k">単価履歴</div>
            <div className="v">{histTotal} <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontWeight: 400 }}>件</span></div>
          </div>
          <div>
            <div className="k">ステータス</div>
            <div className="v" style={{ fontSize: 13 }}>
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "2px 8px", borderRadius: "var(--r-pill)",
                fontSize: 11, fontWeight: 600,
                background: vendor.is_active
                  ? "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))"
                  : "var(--c-surface-2)",
                color: vendor.is_active ? "var(--c-success)" : "var(--c-text-muted)",
              }}>
                {vendor.is_active ? "有効" : "無効"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="v-grid">

        {/* LEFT: 基本情報 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">業者基本情報</div>
                {isAdmin && !isEditing && (
                  <div className="card-sub" style={{ cursor: "pointer", color: "var(--c-primary)" }} onClick={startEdit}>
                    クリックで編集
                  </div>
                )}
              </div>
            </div>

            {isEditing ? (
              <div style={{ padding: "8px 0" }}>
                {(
                  [
                    { label: "業者名",    field: "vendor_name" as const,      type: "text" },
                    { label: "カナ",      field: "vendor_name_kana" as const,  type: "text" },
                    { label: "郵便番号",  field: "postal_code" as const,       type: "text" },
                    { label: "住所",      field: "address" as const,           type: "textarea" },
                    { label: "電話番号",  field: "phone" as const,             type: "text" },
                    { label: "メール",    field: "email" as const,             type: "text" },
                    { label: "担当者",    field: "contact_person" as const,    type: "text" },
                    { label: "振込先",    field: "bank_info" as const,         type: "textarea" },
                    { label: "備考",      field: "note" as const,              type: "textarea" },
                  ] as const
                ).map(row => (
                  <div key={row.field} className="field-row">
                    <div className="k">{row.label}</div>
                    <div className="v" style={{ padding: "6px 14px", display: "block" }}>
                      {row.type === "textarea" ? (
                        <textarea
                          value={(form[row.field] as string | null | undefined) ?? ""}
                          onChange={e => setForm(p => ({ ...p, [row.field]: e.target.value || null }))}
                          rows={2}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                            background: "var(--c-surface)", color: "var(--c-text)",
                            padding: "4px 8px", fontSize: 12, resize: "vertical", outline: "none",
                          }}
                        />
                      ) : (
                        <Input
                          value={(form[row.field] as string | null | undefined) ?? ""}
                          onChange={e => setForm(p => ({ ...p, [row.field]: e.target.value || null }))}
                          className="h-7 text-xs"
                          style={{ width: "100%" }}
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="field-row">
                  <div className="k">主要工種</div>
                  <div className="v" style={{ padding: "6px 14px", display: "block" }}>
                    <Input
                      value={workTypeInput}
                      onChange={e => setWorkTypeInput(e.target.value)}
                      placeholder="例: 電気工事, 管工事"
                      className="h-7 text-xs"
                      style={{ width: "100%" }}
                    />
                    <p style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 3 }}>カンマ区切り</p>
                  </div>
                </div>
                <div className="field-row">
                  <div className="k">状態</div>
                  <div className="v">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.is_active ?? true}
                        onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                        style={{ accentColor: "var(--c-primary)" }}
                      />
                      有効
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {[
                  { label: "業者名",   value: vendor.vendor_name },
                  { label: "カナ",     value: vendor.vendor_name_kana },
                  { label: "担当者",   value: vendor.contact_person },
                  { label: "郵便番号", value: vendor.postal_code },
                  { label: "住所",     value: vendor.address },
                  { label: "TEL",      value: vendor.phone },
                  { label: "Email",    value: vendor.email },
                  { label: "振込先",   value: vendor.bank_info },
                  { label: "備考",     value: vendor.note },
                ].map((row, i, arr) => (
                  <div key={row.label} className="field-row">
                    <div className="k" style={i === arr.length - 1 ? { borderBottom: "none" } : undefined}>{row.label}</div>
                    <div className="v" style={{
                      borderLeft: "1px solid var(--c-border)",
                      ...(i === arr.length - 1 ? { borderBottom: "none" } : {}),
                    }}>
                      {row.value
                        ? <span style={{ whiteSpace: "pre-wrap" }}>{row.value}</span>
                        : <span style={{ color: "var(--c-text-subtle)" }}>—</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: チャート + 単価履歴 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {histories.length >= 2 && <PriceLineChart histories={histories} />}

          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-head">
              <div>
                <div className="card-title">過去単価履歴</div>
                <div className="card-sub">{histTotal}件</div>
              </div>
              <div className="actions">
                <Input
                  value={histQ}
                  onChange={e => handleHistSearch(e.target.value)}
                  placeholder="項目名で絞り込み"
                  className="h-7 text-xs"
                  style={{ width: 200 }}
                />
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="hist-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>日付</th>
                    <th>項目</th>
                    <th style={{ width: 60 }}>仕様</th>
                    <th className="num" style={{ width: 50 }}>数量</th>
                    <th style={{ width: 46 }}>単位</th>
                    <th className="num" style={{ width: 80 }}>単価</th>
                    <th style={{ width: 64 }}>前回比</th>
                    <th style={{ width: 50 }}>ソース</th>
                  </tr>
                </thead>
                <tbody>
                  {histLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "20px 0", color: "var(--c-text-muted)" }}>
                        読み込み中…
                      </td>
                    </tr>
                  ) : histories.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "20px 0", color: "var(--c-text-muted)" }}>
                        単価履歴がありません
                      </td>
                    </tr>
                  ) : (
                    histories.map(h => {
                      const delta = calcDelta(h, histories);
                      return (
                        <tr key={h.id}>
                          <td className="num" style={{ color: "var(--c-text-muted)" }}>
                            {h.quoted_at ?? "—"}
                          </td>
                          <td>{h.item_name}</td>
                          <td style={{ color: "var(--c-text-muted)" }}>{h.item_spec ?? "—"}</td>
                          <td className="num" style={{ color: "var(--c-text-muted)" }}>
                            {h.quantity?.toLocaleString() ?? "—"}
                          </td>
                          <td style={{ color: "var(--c-text-muted)" }}>{h.unit ?? "—"}</td>
                          <td className="num">
                            {h.unit_price != null
                              ? <strong>¥{Math.round(h.unit_price).toLocaleString()}</strong>
                              : "—"
                            }
                          </td>
                          <td>
                            {delta
                              ? <span className={delta.cls}>{delta.label}</span>
                              : <span style={{ color: "var(--c-text-subtle)", fontSize: 11 }}>—</span>
                            }
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, padding: "1px 6px",
                              background: "var(--c-surface-2)", borderRadius: "var(--r-sm)",
                              color: "var(--c-text-muted)",
                            }}>
                              {SOURCE_LABEL[h.source] ?? h.source}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {histTotalPages > 1 && (
              <div className="pagi">
                <span>
                  {histories.length > 0
                    ? `${(histPage - 1) * HIST_PER_PAGE + 1}–${Math.min(histPage * HIST_PER_PAGE, histTotal)} / ${histTotal}件`
                    : `${histTotal}件`}
                </span>
                <span className="spacer" />
                <button disabled={histPage <= 1} onClick={() => setHistPage(p => p - 1)}>‹</button>
                {Array.from({ length: histTotalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === histTotalPages || Math.abs(n - histPage) <= 1)
                  .map((n, i, arr) => (
                    <Fragment key={n}>
                      {i > 0 && arr[i - 1] !== n - 1 && (
                        <span style={{ color: "var(--c-text-subtle)", padding: "0 2px" }}>…</span>
                      )}
                      <button className={histPage === n ? "on" : ""} onClick={() => setHistPage(n)}>
                        {n}
                      </button>
                    </Fragment>
                  ))
                }
                <button disabled={histPage >= histTotalPages} onClick={() => setHistPage(p => p + 1)}>›</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
