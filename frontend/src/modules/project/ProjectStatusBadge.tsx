/**
 * 案件ステータスバッジ（4値: draft/submitted/won/lost）。
 *
 * 移行先: src/modules/project/ProjectStatusBadge.tsx
 * 旧パス: src/components/project/ProjectStatusBadge.tsx（後方互換 re-export を維持）
 */

import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/project";
import { PROJECT_STATUS_LABEL } from "@/types/project";

const PALETTE: Record<ProjectStatus, { dot: string; text: string; bg: string }> = {
  draft:     { dot: "bg-slate-400",   text: "text-slate-500",   bg: "bg-slate-400/15" },
  submitted: { dot: "bg-blue-500",    text: "text-blue-600",    bg: "bg-blue-500/15" },
  won:       { dot: "bg-green-500",   text: "text-green-600",   bg: "bg-green-500/15" },
  lost:      { dot: "bg-red-500",     text: "text-red-600",     bg: "bg-red-500/15" },
};

interface Props {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: Props) {
  const p = PALETTE[status] ?? PALETTE.quote;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        p.text,
        p.bg,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}
