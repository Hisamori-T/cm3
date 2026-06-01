"use client";

/**
 * SiteSearch — 顧客＋店舗の2段階検索コンポーネント。
 * 案件作成・編集画面などで使い回せる共通部品。
 *
 * 使い方:
 *   <SiteSearch
 *     value={{ clientId, clientName, siteId, siteName }}
 *     onChange={(v) => setClient(v)}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ClientListItem, ClientSiteRead } from "@/types/client";

export interface SiteSearchValue {
  clientId: string | null;
  clientName: string;
  siteId: string | null;
  siteName: string | null;
}

interface Props {
  value: SiteSearchValue;
  onChange: (v: SiteSearchValue) => void;
  siteRequired?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 32, padding: "0 8px", fontSize: 13,
  border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
  background: "var(--c-surface)", color: "var(--c-text)", outline: "none",
  boxSizing: "border-box",
};

export function SiteSearch({ value, onChange, siteRequired = false, disabled = false, placeholder = "顧客名・コードで検索" }: Props) {
  const [clientQuery, setClientQuery] = useState(value.clientName ?? "");
  const [clientCandidates, setClientCandidates] = useState<ClientListItem[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);

  const [sites, setSites] = useState<ClientSiteRead[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [siteQuery, setSiteQuery] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 顧客が選択された状態で clientName が変われば query も同期
  useEffect(() => {
    setClientQuery(value.clientName ?? "");
  }, [value.clientName]);

  // 顧客ID変更時に店舗一覧を取得
  useEffect(() => {
    if (!value.clientId) { setSites([]); return; }
    apiFetch<ClientSiteRead[]>(`/api/v1/clients/${value.clientId}/sites`)
      .then(setSites)
      .catch(() => setSites([]));
  }, [value.clientId]);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowClientList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setClientCandidates([]); setShowClientList(false); return; }
    setClientLoading(true);
    try {
      const results = await apiFetch<ClientListItem[]>(`/api/v1/clients/search?q=${encodeURIComponent(q)}&limit=10`);
      setClientCandidates(results);
      setShowClientList(true);
    } catch {
      setClientCandidates([]);
    } finally {
      setClientLoading(false);
    }
  }, []);

  const handleClientInput = (v: string) => {
    setClientQuery(v);
    // 入力中は clientId をクリア
    if (value.clientId) {
      onChange({ clientId: null, clientName: v, siteId: null, siteName: null });
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(v), 300);
  };

  const selectClient = (c: ClientListItem) => {
    onChange({ clientId: c.id, clientName: c.client_name, siteId: null, siteName: null });
    setClientQuery(c.client_name);
    setShowClientList(false);
    setRegionFilter("all");
    setSiteQuery("");
  };

  const clearClient = () => {
    onChange({ clientId: null, clientName: "", siteId: null, siteName: null });
    setClientQuery("");
    setSites([]);
    setRegionFilter("all");
    setSiteQuery("");
  };

  const selectSite = (s: ClientSiteRead) => {
    onChange({ ...value, siteId: s.id, siteName: s.site_name });
  };

  const clearSite = () => {
    onChange({ ...value, siteId: null, siteName: null });
  };

  // 店舗絞り込み
  const regions = Array.from(new Set(sites.map(s => s.region ?? "その他"))).sort();
  const filteredSites = sites
    .filter(s => regionFilter === "all" || (s.region ?? "その他") === regionFilter)
    .filter(s => !siteQuery || s.site_name.includes(siteQuery) || (s.region ?? "").includes(siteQuery));

  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 顧客検索 */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <div style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              color: "var(--c-text-muted)", pointerEvents: "none",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              value={clientQuery}
              onChange={e => handleClientInput(e.target.value)}
              onFocus={() => { if (clientCandidates.length > 0) setShowClientList(true); }}
              placeholder={placeholder}
              disabled={disabled}
              style={{ ...inputStyle, paddingLeft: 28 }}
            />
          </div>
          {value.clientId && (
            <button
              type="button"
              onClick={clearClient}
              disabled={disabled}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--c-text-muted)", padding: "4px 6px", fontSize: 16, lineHeight: 1,
              }}
              title="クリア"
            >
              ×
            </button>
          )}
        </div>

        {/* 候補ドロップダウン */}
        {showClientList && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "var(--c-surface)", border: "1px solid var(--c-border)",
            borderRadius: "var(--r-md)", boxShadow: "var(--sh-2)",
            maxHeight: 240, overflowY: "auto",
          }}>
            {clientLoading ? (
              <div style={{ padding: "10px 12px", color: "var(--c-text-muted)", fontSize: 12 }}>検索中…</div>
            ) : clientCandidates.length === 0 ? (
              <div style={{ padding: "10px 12px", color: "var(--c-text-muted)", fontSize: 12 }}>該当なし</div>
            ) : clientCandidates.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => selectClient(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "8px 12px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left", fontSize: 13,
                }}
                className="hover:bg-[var(--c-hover)]"
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "var(--r-sm)", flexShrink: 0,
                  background: "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))",
                  color: "var(--c-primary)", fontSize: 11, fontWeight: 700,
                  display: "grid", placeItems: "center",
                }}>
                  {c.client_name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--c-text)" }}>{c.client_name}</div>
                  {c.client_name_kana && <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{c.client_name_kana}</div>}
                </div>
                {c.client_rank && (
                  <span style={{
                    marginLeft: "auto", fontSize: 10, fontWeight: 700,
                    padding: "1px 6px", borderRadius: "50%",
                    background: "var(--c-surface-2)", color: "var(--c-text-muted)",
                  }}>
                    {c.client_rank}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 選択済み顧客の確認チップ */}
      {value.clientId && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px", borderRadius: "var(--r-pill)",
          background: "color-mix(in oklab, var(--c-primary) 10%, var(--c-surface))",
          border: "1px solid color-mix(in oklab, var(--c-primary) 25%, var(--c-border))",
          fontSize: 12, fontWeight: 500, color: "var(--c-primary)",
          alignSelf: "flex-start",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {value.clientName}
        </div>
      )}

      {/* 店舗選択（顧客選択後に表示） */}
      {value.clientId && sites.length > 0 && (
        <div style={{
          background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
          borderRadius: "var(--r-md)", padding: "10px 12px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-muted)", marginBottom: 8 }}>
            店舗・拠点 ({sites.length}件)
            {siteRequired && <span style={{ color: "var(--c-danger)", marginLeft: 4 }}>*</span>}
          </div>

          {/* 地域フィルタ + 検索 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            {regions.length > 1 && (
              <>
                <button
                  type="button"
                  className={`pill${regionFilter === "all" ? " on" : ""}`}
                  onClick={() => setRegionFilter("all")}
                  style={{ fontSize: 11 }}
                >
                  全地域
                </button>
                {regions.map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`pill${regionFilter === r ? " on" : ""}`}
                    onClick={() => setRegionFilter(r)}
                    style={{ fontSize: 11 }}
                  >
                    {r}
                  </button>
                ))}
              </>
            )}
            {sites.length > 8 && (
              <input
                value={siteQuery}
                onChange={e => setSiteQuery(e.target.value)}
                placeholder="店舗名で絞り込み"
                style={{ ...inputStyle, width: 160, height: 26, fontSize: 12 }}
              />
            )}
          </div>

          {/* 選択済み店舗 */}
          {value.siteId && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px", marginBottom: 8, borderRadius: "var(--r-md)",
              background: "color-mix(in oklab, var(--c-success) 12%, var(--c-surface))",
              border: "1px solid color-mix(in oklab, var(--c-success) 28%, var(--c-border))",
              fontSize: 12, color: "var(--c-success)",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span style={{ flex: 1, fontWeight: 500 }}>{value.siteName}</span>
              <button
                type="button"
                onClick={clearSite}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: "0 2px", fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          )}

          {/* 店舗リスト */}
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredSites.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--c-text-muted)", padding: "6px 0" }}>該当する店舗がありません</div>
            ) : filteredSites.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSite(s)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: "var(--r-sm)",
                  background: value.siteId === s.id ? "color-mix(in oklab, var(--c-primary) 12%, var(--c-surface))" : "transparent",
                  border: "1px solid",
                  borderColor: value.siteId === s.id ? "color-mix(in oklab, var(--c-primary) 30%, var(--c-border))" : "transparent",
                  cursor: "pointer", textAlign: "left", fontSize: 12, width: "100%",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ flex: 1, fontWeight: value.siteId === s.id ? 600 : 400, color: value.siteId === s.id ? "var(--c-primary)" : "var(--c-text)" }}>
                  {s.site_name}
                </span>
                {s.region && (
                  <span style={{ fontSize: 10, color: "var(--c-text-muted)", flexShrink: 0 }}>{s.region}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 顧客未選択時の店舗エリア（siteRequired ヒント） */}
      {!value.clientId && siteRequired && (
        <div style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
          ※ 顧客を選択すると店舗を指定できます
        </div>
      )}
    </div>
  );
}
