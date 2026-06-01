/**
 * Construction Manager v3 — 案件ステータスバッジ
 *
 * frontend/src/components/project/ProjectStatusBadge.tsx
 *
 * 7段階を共通の見た目で表示する。前回デザインの .badge.s-* と整合。
 * dot + text、背景は color-mix の代わりに Tailwind の bg-* と opacity を併用。
 */

import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABEL } from '@/types/project';

const PALETTE: Record<ProjectStatus, { dot: string; text: string; bg: string }> = {
  quote:    { dot: 'bg-status-quote',    text: 'text-status-quote',    bg: 'bg-status-quote/15' },
  order:    { dot: 'bg-status-order',    text: 'text-status-order',    bg: 'bg-status-order/15' },
  start:    { dot: 'bg-status-start',    text: 'text-status-start',    bg: 'bg-status-start/15' },
  progress: { dot: 'bg-status-progress', text: 'text-status-progress', bg: 'bg-status-progress/15' },
  done:     { dot: 'bg-status-done',     text: 'text-status-done',     bg: 'bg-status-done/15' },
  billed:   { dot: 'bg-status-billed',   text: 'text-status-billed',   bg: 'bg-status-billed/15' },
  paid:     { dot: 'bg-status-paid',     text: 'text-status-paid',     bg: 'bg-status-paid/15' },
};

interface Props {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: Props) {
  const p = PALETTE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        p.text,
        p.bg,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}
