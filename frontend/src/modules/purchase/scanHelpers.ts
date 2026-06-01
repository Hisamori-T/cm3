/**
 * スキャンレビュー画面の信頼度ヘルパー関数。
 * 抽出元: src/app/scan/[job_id]/page.tsx
 * これらは純粋関数（state 非依存）のため安全に分離できる。
 */

import type React from "react";

/** 信頼度スコア → クラス文字列 */
export function confClass(c: number | null | undefined): "h" | "m" | "l" | "" {
  if (c == null) return "";
  if (c >= 0.85) return "h";
  if (c >= 0.60) return "m";
  return "l";
}

/** 信頼度クラス → インラインスタイル */
export function confStyle(cls: "h" | "m" | "l" | ""): React.CSSProperties {
  if (cls === "h")
    return {
      color: "var(--c-success)",
      background: "color-mix(in oklab, var(--c-success) 14%, var(--c-surface))",
    };
  if (cls === "m")
    return { color: "#b45309", background: "var(--c-warn-bg)" };
  if (cls === "l")
    return { color: "var(--c-danger)", background: "var(--c-danger-bg)" };
  return {};
}

/** 信頼度スコア → セル背景色 */
export function cellBg(c: number | null | undefined): string {
  if (c == null) return "";
  if (c < 0.6)
    return "color-mix(in oklab, var(--c-danger) 12%, var(--c-surface))";
  if (c < 0.75)
    return "color-mix(in oklab, var(--c-warn) 14%, var(--c-surface))";
  return "";
}
