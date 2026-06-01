"use client";

import type { RefObject } from "react";

// ───────────────────────────────────────────────
// 型（page.tsx でも使用するため export）
// ───────────────────────────────────────────────

export interface ScanJob {
  jobId: string;
  fileName: string;
  status: "uploading" | "analyzing" | "saving" | "done" | "error";
  message: string;
}

export interface ScanZoneProps {
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  handleScanFiles: (files: File[]) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  pendingScanJobs: ScanJob[];
}

// ───────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────

export function ScanZone({
  isDragging,
  setIsDragging,
  handleScanFiles,
  fileInputRef,
  pendingScanJobs,
}: ScanZoneProps) {
  return (
    <>
      {/* D&Dゾーン */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) handleScanFiles(files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          margin: "8px",
          padding: "12px 8px",
          border: `2px dashed ${isDragging ? "var(--c-primary)" : "var(--c-border)"}`,
          borderRadius: "var(--r-md)",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "color-mix(in oklab, var(--c-primary) 8%, var(--c-surface))" : "transparent",
          transition: "all 0.15s ease",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={isDragging ? "var(--c-primary)" : "var(--c-text-muted)"}
          strokeWidth="1.5" style={{ display: "block", margin: "0 auto 4px" }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 12 15 15" />
        </svg>
        <div style={{ fontSize: 11, fontWeight: 600, color: isDragging ? "var(--c-primary)" : "var(--c-text-muted)" }}>
          {isDragging ? "ドロップしてスキャン開始" : "PDF / 画像をドロップ"}
        </div>
        <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>またはクリックして選択</div>
      </div>

      {/* スキャン中のジョブ一覧（小型表示） */}
      {pendingScanJobs.length > 0 && (
        <div style={{ borderBottom: "1px solid var(--c-border)" }}>
          {pendingScanJobs.map(job => (
            <div key={job.jobId} style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>
              {job.status !== "error" ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-primary)" strokeWidth="2.5"
                  style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                </svg>
              )}
              <span style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: job.status === "error" ? "var(--c-danger)" : "var(--c-text-muted)" }}>
                {job.fileName.length > 16 ? job.fileName.slice(0, 14) + "…" : job.fileName}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
