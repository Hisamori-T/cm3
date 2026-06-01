/**
 * ページネーション共通コンポーネント。
 * 「前へ / 次へ」ボタン＋「X件中 Y〜Z件」表示。
 * 既存ページに散在していたページネーション UI を一元管理する。
 */

import React from "react";

interface PaginationProps {
  /** 現在のページ番号（1始まり） */
  page: number;
  /** 1ページあたりの件数 */
  perPage: number;
  /** 総件数 */
  total: number;
  /** 前のページへ */
  onPrev: () => void;
  /** 次のページへ */
  onNext: () => void;
  /** コンテナに適用する追加 style */
  style?: React.CSSProperties;
}

export function Pagination({
  page,
  perPage,
  total,
  onPrev,
  onNext,
  style,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const hasPrev = page > 1;
  const hasNext = to < total;

  const btnStyle: React.CSSProperties = {
    padding: "4px 12px",
    border: "1px solid var(--c-border)",
    borderRadius: "var(--radius-sm, 4px)",
    background: "var(--c-surface)",
    color: "var(--c-text)",
    cursor: "pointer",
    fontSize: "var(--fs-sm, 13px)",
  };

  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.4,
    cursor: "not-allowed",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2, 8px)",
        ...style,
      }}
    >
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        style={hasPrev ? btnStyle : btnDisabledStyle}
      >
        ‹ 前へ
      </button>
      <span
        style={{
          fontSize: "var(--fs-sm, 13px)",
          color: "var(--c-text-muted)",
          minWidth: 120,
          textAlign: "center",
        }}
      >
        {total === 0 ? "0件" : `${total}件中 ${from}〜${to}件`}
      </span>
      <button
        onClick={onNext}
        disabled={!hasNext}
        style={hasNext ? btnStyle : btnDisabledStyle}
      >
        次へ ›
      </button>
    </div>
  );
}
