"use client";

import { useState } from "react";
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

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectListItem) => void;
}

/** 新規案件作成モーダル。最小必須項目（工事名）のみ入力。 */
export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [orderType, setOrderType] = useState<"private" | "government" | "">("");
  const [contractType, setContractType] = useState<"prime" | "sub" | "">("");
  const [projectNumber, setProjectNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setProjectName("");
    setClientName("");
    setOrderType("");
    setContractType("");
    setProjectNumber("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError("工事名は必須です");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const body: ProjectCreate = {
      project_name: projectName.trim(),
      ...(clientName.trim() && { client_name: clientName.trim() }),
      ...(orderType && { order_type: orderType }),
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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              発注者
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="株式会社○○"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                発注区分
              </label>
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
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                請負区分
              </label>
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

          {error && (
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          )}

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
