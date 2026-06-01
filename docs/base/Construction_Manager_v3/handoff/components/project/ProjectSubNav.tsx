/**
 * Construction Manager v3 — 案件サブナビ
 *
 * frontend/src/components/project/ProjectSubNav.tsx
 *
 * 前回デザインの .proj-subnav と完全に整合。
 * - 9タブ（詳細 / QCDS / 業者見積 / 顧客見積 / 注文書 / 注文請書 / 請求書 / 進捗 / 編集履歴）
 * - 件数バッジ付き、0件は薄いグレー
 * - アクティブタブはクラップネイビーの下線
 * - usePathname で現在地を判定
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ProjectSubPath } from '@/types/project';

interface Props {
  projectId: string;
  counts: Record<ProjectSubPath, number>;
}

interface Tab {
  key: ProjectSubPath;
  label: string;
  href: (id: string) => string;
}

const TABS: Tab[] = [
  { key: 'detail',         label: '詳細',     href: (id) => `/projects/${id}` },
  { key: 'qcds',           label: 'QCDS',     href: (id) => `/projects/${id}/qcds` },
  { key: 'vendor-quotes',  label: '業者見積', href: (id) => `/projects/${id}/vendor-quotes` },
  { key: 'quote',          label: '顧客見積', href: (id) => `/projects/${id}/quote` },
  { key: 'order',          label: '注文書',   href: (id) => `/projects/${id}/order` },
  { key: 'acknowledgement',label: '注文請書', href: (id) => `/projects/${id}/acknowledgement` },
  { key: 'invoice',        label: '請求書',   href: (id) => `/projects/${id}/invoice` },
  { key: 'progress',       label: '進捗',     href: (id) => `/projects/${id}/progress` },
  { key: 'history',        label: '編集履歴', href: (id) => `/projects/${id}/history` },
];

export function ProjectSubNav({ projectId, counts }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-2 overflow-x-auto">
      {TABS.map((tab) => {
        const href = tab.href(projectId);
        // /projects/[id]/order/something は order tab を active 扱い
        const isActive =
          tab.key === 'detail'
            ? pathname === `/projects/${projectId}`
            : pathname.startsWith(href);
        const count = counts[tab.key] ?? 0;

        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap',
              'border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-brand text-brand dark:text-white bg-white dark:bg-neutral-900 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-white dark:hover:bg-neutral-900 dark:hover:text-white',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={cn(
                  'inline-flex min-w-[18px] justify-center rounded-full px-1.5 text-[10px] font-semibold font-mono',
                  isActive
                    ? 'bg-brand text-white'
                    : 'bg-white text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                )}
              >
                {count}
              </span>
            )}
            {count === 0 && (
              <span className="font-mono text-[10px] text-neutral-300 dark:text-neutral-700">0</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
