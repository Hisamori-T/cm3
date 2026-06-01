/**
 * Construction Manager v3 — 注文書ステータスドロップダウン
 *
 * frontend/src/components/order/OrderStatusDropdown.tsx
 *
 * draft / sent / signed / acknowledged / cancelled の5値を切り替える。
 * 状態ごとに枠色と背景色が変わる（前回デザイン .ord-status と同一）。
 *
 * shadcn/ui DropdownMenu を使用。
 */

'use client';

import { useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/order';
import { ORDER_STATUS_LABEL } from '@/types/order';

interface Props {
  orderId: string;
  status: OrderStatus;
  /** 楽観 UI 後にバックエンド patch、失敗時はトーストで通知 */
  onChange: (next: OrderStatus) => void;
}

const STYLE: Record<OrderStatus, string> = {
  draft:        'border-neutral-400 text-neutral-500',
  sent:         'border-status-order text-status-order bg-status-order/10',
  signed:       'border-status-progress text-amber-700 bg-amber-50 dark:bg-amber-900/20',
  acknowledged: 'border-status-done text-status-done bg-status-done/10',
  cancelled:    'border-stamp text-stamp bg-red-50 dark:bg-red-900/20',
};

const DOT: Record<OrderStatus, string> = {
  draft:        'bg-neutral-400',
  sent:         'bg-status-order',
  signed:       'bg-status-progress',
  acknowledged: 'bg-status-done',
  cancelled:    'bg-stamp',
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:        ['sent', 'cancelled'],
  sent:         ['signed', 'cancelled'],
  signed:       ['acknowledged', 'cancelled'],
  acknowledged: ['cancelled'],
  cancelled:    [],
};

export function OrderStatusDropdown({ orderId, status, onChange }: Props) {
  const [pending, start] = useTransition();

  const apply = (next: OrderStatus) => {
    start(async () => {
      try {
        // ここで PATCH /api/v1/orders/{id}/status { status: next }
        const res = await fetch(`/api/v1/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error(`failed: ${res.status}`);
        onChange(next);
        toast.success(`ステータスを「${ORDER_STATUS_LABEL[next]}」に変更しました`);
      } catch (e) {
        toast.error('ステータス変更に失敗しました');
      }
    });
  };

  const allowedNext = TRANSITIONS[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border-[1.5px] bg-white px-3 py-1.5 text-xs font-bold transition-colors',
            STYLE[status],
            pending && 'opacity-60',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', DOT[status])} />
          {status}
          <ChevronDown className="h-3 w-3 text-neutral-400" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500">
          ステータスを変更
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(['draft', 'sent', 'signed', 'acknowledged', 'cancelled'] as OrderStatus[]).map((s) => {
          const isCurrent = s === status;
          const allowed = isCurrent || allowedNext.includes(s);
          return (
            <DropdownMenuItem
              key={s}
              disabled={!allowed || isCurrent}
              onClick={() => apply(s)}
              className="gap-2 text-xs"
            >
              <span className={cn('h-2 w-2 rounded-full', DOT[s])} />
              <span className="flex-1">{ORDER_STATUS_LABEL[s]}</span>
              {isCurrent && <span className="text-[10px] text-neutral-400">現在</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
