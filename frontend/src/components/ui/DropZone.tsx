/**
 * ドラッグ＆ドロップ / クリックアップロード共通コンポーネント。
 * purchase/page.tsx および estimate/page.tsx で重複していた D&D ロジックを一元管理する。
 */

"use client";

import React, { useRef, useState } from "react";

interface DropZoneProps {
  /** ファイルが選択・ドロップされたときに呼ばれる */
  onFile: (file: File) => void;
  /** accept 属性（例: ".pdf,.xlsx,.jpg"）。デフォルト: PDF/Excel/画像 */
  accept?: string;
  /** スキャン中など処理中フラグ。true の間はクリック・ドロップを無効化 */
  scanning?: boolean;
  /** 処理中に表示するメッセージ */
  scanMsg?: string;
  /** アイドル時に表示するメインテキスト */
  mainText?: string;
  /** アイドル時に表示するサブテキスト */
  subText?: string;
  /** アイドル時のアイコン絵文字。デフォルト: "📎" */
  icon?: string;
  /** コンテナの最小高さ（px）。デフォルト: 120 */
  minHeight?: number;
  /** 追加 style */
  style?: React.CSSProperties;
}

export function DropZone({
  onFile,
  accept = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg",
  scanning = false,
  scanMsg = "",
  mainText = "ファイルをここにドラッグ＆ドロップ",
  subText = "PDF / Excel (.xlsx) / 画像 — またはクリックしてファイル選択",
  icon = "📎",
  minHeight = 120,
  style,
}: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (scanning) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!scanning) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => { if (!scanning) fileInputRef.current?.click(); }}
        style={{
          border: `2px dashed ${dragOver ? "var(--c-brand, #3b82f6)" : "var(--c-border)"}`,
          borderRadius: "var(--radius-sm, 4px)",
          padding: "var(--sp-6, 24px) var(--sp-4, 16px)",
          minHeight,
          textAlign: "center",
          cursor: scanning ? "wait" : "pointer",
          background: dragOver ? "#eff6ff" : "var(--c-surface-2)",
          color: "var(--c-text-muted)",
          fontSize: "var(--fs-sm, 13px)",
          transition: "all 0.15s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-1, 4px)",
          ...style,
        }}
      >
        {scanning ? (
          <>
            <span style={{ fontSize: 28 }}>⏳</span>
            <span>{scanMsg || "処理中…"}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 32 }}>{icon}</span>
            <span style={{ fontWeight: 600 }}>{mainText}</span>
            <span style={{ fontSize: "var(--fs-xs, 11px)" }}>{subText}</span>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </>
  );
}
