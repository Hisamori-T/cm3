"use client";

// ───────────────────────────────────────────────
// 型（page.tsx でも使用するため export）
// ───────────────────────────────────────────────

export interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

export interface ApprovalStampsProps {
  personInChargeId: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  approverId: string | null;
  approvedAt: string | null;
  stampUsers: UserOption[];
  /** 現在 pending の承認依頼ステップの承認者名（approval_requests から算出） */
  pendingApproverName?: string | null;
}

// ───────────────────────────────────────────────
// 書類風スタンプボード（純粋表示、操作なし）
// ───────────────────────────────────────────────

export function ApprovalStamps({
  personInChargeId,
  reviewerId,
  reviewedAt,
  approverId,
  approvedAt,
  stampUsers,
  pendingApproverName,
}: ApprovalStampsProps) {
  // 左から 承認・確認・担当 の順（quote.html 準拠）
  const stamps = [
    { label: "承　認", userId: approverId, at: approvedAt },
    { label: "確　認", userId: reviewerId, at: reviewedAt },
    {
      label: "担　当",
      userId: personInChargeId,
      // 担当はヘッダーの担当者が設定されていれば常に「表示済み」扱い
      at: personInChargeId ? "__auto__" : null,
    },
  ];

  const doneCount = stamps.filter(s => s.at).length;

  return (
    <div style={{
      padding: 14,
      background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      borderRadius: "var(--r-lg)",
      marginTop: 12,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)",
        letterSpacing: "0.06em", textTransform: "uppercase" as const,
        marginBottom: 10,
      }}>
        印影プレビュー（帳票出力時に自動配置）
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid #999" }}>
        {stamps.map(({ label, userId, at }, i) => {
          const stampedUser = stampUsers.find(u => u.id === userId);
          const isStamped = !!at;

          return (
            <div
              key={label}
              style={{
                borderRight: i < stamps.length - 1 ? "1px solid #999" : "none",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}
            >
              {/* ロールラベル行 */}
              <div style={{
                width: "100%", textAlign: "center", fontSize: 11, fontWeight: 700,
                padding: "4px 0", borderBottom: "1px solid #999",
                background: "#f8f8f8", color: "#111", letterSpacing: 2,
              }}>
                {label}
              </div>

              {/* 印影エリア（クリック不可・表示のみ） */}
              <div style={{
                width: "100%", height: 80,
                display: "grid", placeItems: "center",
                background: isStamped ? "var(--c-surface)" : "repeating-linear-gradient(45deg,var(--c-warn-bg),var(--c-warn-bg) 6px,transparent 6px,transparent 12px)",
              }}>
                {isStamped && stampedUser ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      border: "2px solid #C00000",
                      margin: "0 auto 2px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "color-mix(in oklab, #C00000 6%, white)",
                      fontFamily: "'Noto Serif CJK JP', 'Hiragino Mincho ProN', serif",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#C00000", lineHeight: 1 }}>
                        {stampedUser.full_name.split(/[\s　]/)[0].slice(0, 3)}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: "#C00000", fontWeight: 600 }}>
                      {at && at !== "__auto__"
                        ? new Date(at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
                        : "担当"}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 10, color: "var(--c-warn)", fontWeight: 600 }}>
                    {userId ? "承認待ち" : "未設定"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ステータスメモ */}
      <div style={{ fontSize: 10, color: "var(--c-text-muted)", textAlign: "center", marginTop: 6, lineHeight: 1.5 }}>
        {doneCount > 0 && <span>{doneCount} / {stamps.length} 承認済み</span>}
        {pendingApproverName
          ? <> · <strong style={{ color: "var(--c-text)" }}>{pendingApproverName}</strong> の承認待ち · 承認後にこの位置に印影が押されます</>
          : doneCount === 0 ? "承認依頼を送信すると印影が配置されます" : null}
      </div>
    </div>
  );
}
