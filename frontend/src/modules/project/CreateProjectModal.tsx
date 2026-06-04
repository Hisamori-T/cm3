/**
 * 新規案件作成モーダル。工事名 + 顧客マスタ連携 + 発注区分/請負区分/工事番号。
 *
 * Phase C-4-4: 発注者フィールドを顧客マスタ検索に変更し、client_id を送信する。
 * 顧客マスタにない場合はフリーテキスト入力も許可（client_name のみ送信）。
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ProjectCreate, ProjectListItem } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ClientItem {
  id: string;
  client_name: string;
  client_code: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectListItem) => void;
}

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [projectName, setProjectName]     = useState("");
  const [orderType, setOrderType]         = useState<"private" | "government" | "">("");
  const [contractType, setContractType]   = useState<"prime" | "sub" | "">("");
  const [projectNumber, setProjectNumber] = useState("");
  const [error, setError]                 = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // 顧客検索
  const [clientQuery, setClientQuery]   = useState("");
  const [clientId, setClientId]         = useState<string | null>(null);
  const [clientSuggestions, setClientSuggestions] = useState<ClientItem[]>([]);
  const [showSuggestions, setShowSuggestions]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setClientSuggestions([]); return; }
    try {
      const rows = await apiFetch<ClientItem[]>(`/api/v1/clients/search?q=${encodeURIComponent(q)}&limit=8`);
      setClientSuggestions(rows);
    } catch { setClientSuggestions([]); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(clientQuery), 300);
  }, [clientQuery, searchClients]);

  const selectClient = (c: ClientItem) => {
    setClientId(c.id);
    setClientQuery(c.client_name);
    setClientSuggestions([]);
    setShowSuggestions(false);
  };

  const clearClient = () => {
    setClientId(null);
    setClientQuery("");
    setClientSuggestions([]);
  };

  const reset = () => {
    setProjectName("");
    clearClient();
    setOrderType("");
    setContractType("");
    setProjectNumber("");
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) { setError("工事名は必須です"); return; }
    setError(null);
    setIsSubmitting(true);

    const body: ProjectCreate = {
      project_name: projectName.trim(),
      ...(clientId && { client_id: clientId }),
      ...(clientQuery.trim() && !clientId && { client_name: clientQuery.trim() }),
      ...(orderType    && { order_type: orderType }),
      ...(contractType && { contract_type: contractType }),
      ...(projectNumber.trim() && { project_number: projectNumber.trim() }),
    };

    try {
      const created = await apiFetch<ProjectListItem>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify(body),
      });
      reset();
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("その工事番号は既に使用されています");
      } else {
        setError("作成に失敗しました。もう一度お試しください");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新規案件作成</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 工事名 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              工事名 <span className="text-[var(--color-error)]">*</span>
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="○○ビル内装改修工事"
              autoFocus
            />
          </div>

          {/* 発注者（顧客マスタ検索） */}
          <div className="space-y-1" style={{ position: "relative" }}>
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              発注者
              {clientId && (
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--c-success)", fontWeight: 600 }}>
                  ✓ マスタ連携済
                </span>
              )}
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Input
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                    setClientId(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="顧客名を入力（マスタ検索 or 直接入力）"
                  style={{ borderColor: clientId ? "var(--c-success)" : undefined }}
                />
                {showSuggestions && clientSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    background: "var(--c-surface)", border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-md)", boxShadow: "var(--sh-pop)",
                    maxHeight: 200, overflowY: "auto",
                  }}>
                    {clientSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => selectClient(c)}
                        style={{
                          width: "100%", textAlign: "left", padding: "8px 12px",
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 13, borderBottom: "1px solid var(--c-border)",
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontWeight: 600 }}>{c.client_name}</span>
                        {c.client_code && (
                          <span style={{ fontSize: 11, color: "var(--c-text-muted)", fontFamily: "monospace" }}>
                            {c.client_code}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {clientId && (
                <button
                  type="button"
                  onClick={clearClient}
                  style={{
                    padding: "4px 8px", background: "var(--c-surface-2)",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                    cursor: "pointer", fontSize: 11, color: "var(--c-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  解除
                </button>
              )}
            </div>
            {!clientId && clientQuery && (
              <p style={{ fontSize: 11, color: "var(--c-text-muted)", marginTop: 2 }}>
                ⚠ マスタ未連携。顧客マスタに登録する場合は顧客マスタページから先に登録してください。
              </p>
            )}
          </div>

          {/* 発注区分・請負区分 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">発注区分</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as typeof orderType)}
                className="w-full h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">選択なし</option>
                <option value="private">民間</option>
                <option value="government">官庁</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">請負区分</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as typeof contractType)}
                className="w-full h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">選択なし</option>
                <option value="prime">元請</option>
                <option value="sub">下請</option>
              </select>
            </div>
          </div>

          {/* 工事番号 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              工事番号（省略すると自動採番）
            </label>
            <Input
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="例: 26-1-001"
            />
          </div>

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
