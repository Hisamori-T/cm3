/**
 * ステータスバッジ共通コンポーネント。
 * label と color（CSS カラー文字列）を渡すだけで一貫したバッジ UI を表示する。
 */

import React from "react";

interface StatusBadgeProps {
  /** 表示するラベル文字列 */
  label: string;
  /** バッジの色（CSS カラー値, 例: "#3b82f6"）。デフォルト: "#94a3b8" */
  color?: string;
  /** 追加の style。既存スタイルに上書きマージされる */
  style?: React.CSSProperties;
  /** 追加の className */
  className?: string;
}

/**
 * 背景色に 0x22 の透明度を付けた色でバッジを表示するユーティリティ。
 */
export function StatusBadge({
  label,
  color = "#94a3b8",
  style,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        fontSize: "var(--fs-xs, 11px)",
        padding: "2px 8px",
        borderRadius: 4,
        background: color + "22",
        color: color,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}

/**
 * ステータス設定レコードから StatusBadge を生成するファクトリ。
 * 既存ページの STATUS_LABEL / STATUS_COLOR レコードをそのまま渡せる。
 *
 * @example
 * const LABELS = { draft: "下書き", issued: "発行済" };
 * const COLORS = { draft: "#94a3b8", issued: "#3b82f6" };
 * const badge = makeStatusBadge(LABELS, COLORS);
 * // JSX: <badge.Component status="draft" />
 */
export function makeStatusBadge<T extends string>(
  labels: Record<T, string>,
  colors: Record<T, string>,
) {
  return function StatusBadgeFromConfig({
    status,
    style,
    className,
  }: {
    status: T;
    style?: React.CSSProperties;
    className?: string;
  }) {
    return (
      <StatusBadge
        label={labels[status] ?? status}
        color={colors[status] ?? "#94a3b8"}
        style={style}
        className={className}
      />
    );
  };
}
