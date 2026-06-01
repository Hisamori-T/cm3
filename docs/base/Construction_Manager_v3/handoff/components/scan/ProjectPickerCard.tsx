/**
 * Construction Manager v3 — スキャン編集画面の「デカい案件選択カード」
 *
 * frontend/src/components/scan/ProjectPickerCard.tsx
 *
 * 前回デザイン .pp-card と完全に整合。
 *   - 未選択時：黄色背景 + 警告アイコン + 「案件を選択してください」
 *   - 選択済 ：クラップネイビーの太枠 + halo（box-shadow リング）+ 案件番号/件名/ステータスを大きく
 *   - 「変更」ボタンで CommandDialog（shadcn/ui Command）を開いて案件を検索
 */

'use client';

import { useState } from 'react';
import { Check, Search, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ProjectStatusBadge } from '@/components/project/ProjectStatusBadge';
import { cn } from '@/lib/utils';
import type { ProjectHeader } from '@/types/project';

interface Props {
  linkedProject: ProjectHeader | null;
  candidates: ProjectHeader[];
  onSelect: (project: ProjectHeader) => void;
  onClear: () => void;
}

export function ProjectPickerCard({ linkedProject, candidates, onSelect, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const isEmpty = !linkedProject;

  return (
    <div
      className={cn(
        'grid grid-cols-[36px_1fr_auto] items-center gap-4 rounded-lg border-2 p-4',
        isEmpty
          ? 'border-status-progress bg-amber-50 dark:bg-amber-900/20 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]'
          : 'border-brand bg-white dark:bg-neutral-900 shadow-[0_0_0_4px_var(--c-primary-50)]',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'grid h-9 w-9 place-items-center rounded-md text-white',
          isEmpty ? 'bg-status-progress' : 'bg-brand',
        )}
      >
        {isEmpty ? (
          <AlertTriangle className="h-4 w-4" strokeWidth={1.6} />
        ) : (
          <Check className="h-4 w-4" strokeWidth={2} />
        )}
      </div>

      {/* Body */}
      <div>
        <div
          className={cn(
            'mb-1 text-[11px] font-semibold uppercase tracking-wider',
            isEmpty ? 'text-status-progress' : 'text-neutral-500',
          )}
        >
          {isEmpty ? '⚠ 転記先 案件が未選択です' : '転記先 案件'}
        </div>
        {isEmpty ? (
          <>
            <div className="text-base font-bold text-status-progress">案件を選択してください</div>
            <div className="mt-0.5 text-xs text-neutral-500">
              解析結果を転記する案件を選んでから操作してください
            </div>
            <button
              onClick={() => setOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-md border-[1.5px] border-status-progress bg-white px-3 py-1.5 text-xs text-neutral-500"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
              工事名・工事番号・発注者で検索
            </button>
          </>
        ) : (
          <div className="flex items-baseline gap-3">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-sm font-semibold text-neutral-500 dark:bg-neutral-800">
              {linkedProject.projectNumber}
            </span>
            <span className="text-lg font-bold text-neutral-900 dark:text-white">{linkedProject.name}</span>
            <span className="ml-2 text-xs text-neutral-500">{linkedProject.client} ·</span>
            <ProjectStatusBadge status={linkedProject.status} className="text-[10px]" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button variant={isEmpty ? 'default' : 'outline'} size="sm" onClick={() => setOpen(true)}>
          {isEmpty ? '案件を選択' : '変更'}
        </Button>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={onClear} aria-label="紐付け解除">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* CommandDialog: 案件検索 — shadcn/ui の Command コンポーネント */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="工事番号・工事名・発注者で検索..." />
        <CommandList>
          <CommandEmpty>該当する案件がありません</CommandEmpty>
          <CommandGroup heading="進行中の案件">
            {candidates.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="flex items-center gap-3"
              >
                <span className="rounded-sm bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800">
                  {p.projectNumber}
                </span>
                <span className="flex-1">{p.name}</span>
                <span className="text-xs text-neutral-400">{p.client}</span>
                <ProjectStatusBadge status={p.status} className="text-[10px]" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
