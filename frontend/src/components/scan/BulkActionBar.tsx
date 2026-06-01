/**
 * スキャン一括操作バー。
 * 1件以上選択されたときだけ上部に出るバー。ハンドオフデザイン準拠。
 *   [N件選択中] [選択した案件に転記▼] [CSV出力] [一括削除]
 */

"use client";

import { Check, X, Trash2, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TransferTarget } from "@/types/scan";

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onExportCsv?: () => void;
  onBulkTransfer: (targets: TransferTarget[]) => void;
}

export function BulkActionBar({ count, onClear, onDelete, onExportCsv, onBulkTransfer }: Props) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-[52px] z-10",
        "flex items-center gap-3 rounded-lg bg-brand px-4 py-2.5 text-white shadow-md",
      )}
    >
      <button
        type="button"
        onClick={onClear}
        className="text-white/70 hover:text-white -ml-1"
        aria-label="選択解除"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <span className="text-sm font-bold">
        <span className="mr-1.5 rounded-full bg-white/20 px-2 py-0.5 font-mono text-xs">{count}</span>
        件選択中
      </span>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">
            <Check className="h-3.5 w-3.5" strokeWidth={1.7} />
            選択した案件に転記
            <span className="text-[10px]">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-neutral-500">
            転記先を選択
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onBulkTransfer(["qcds-direct"])}>
            QCDS 直接工事費へ転記
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onBulkTransfer(["vendor-estimate"])}>
            業者見積へ転記
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onBulkTransfer(["qcds-direct", "vendor-estimate"])}>
            すべての転記先へ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onExportCsv && (
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.7} />
          CSV出力
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 rounded-md border border-stamp bg-stamp px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        一括削除
      </button>
    </div>
  );
}
