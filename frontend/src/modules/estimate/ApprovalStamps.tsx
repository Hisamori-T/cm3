"use client";

// ───────────────────────────────────────────────
// 型（page.tsx でも使用するため export）
// ───────────────────────────────────────────────

export interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

type StampType = "person_in_charge" | "reviewer" | "approver";

export interface ApprovalStampsProps {
  personInChargeId: string | null;
  personInChargeConfirmedAt: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  approverId: string | null;
  approvedAt: string | null;
  stampUsers: UserOption[];
  stampTarget: StampType | null;
  setStampTarget: (t: StampType | null) => void;
  stampLoading: boolean;
  userRole: string;
  handleStamp: (stampType: StampType, userId: string, stamp: boolean) => void;
  showMsg: (msg: string) => void;
}

// ───────────────────────────────────────────────
// Component — 書類風スタンプボード（quote.html stampboard 準拠）
// ───────────────────────────────────────────────

export function ApprovalStamps({
  personInChargeId,
  personInChargeConfirmedAt,
  reviewerId,
  reviewedAt,
  approverId,
  approvedAt,
  stampUsers,
  stampTarget,
  setStampTarget,
  stampLoading,
  userRole,
  handleStamp,
  showMsg,
}: ApprovalStampsProps) {
  // 左から 承認・確認・担当 の順（quote.html 準拠）
  const stamps: {
    label: string;
    stampType: StampType;
    userId: string | null;
    at: string | null;
    canStamp: boolean;
    requiredRole: string;
  }[] = [
    {
      label: "承　認",
      stampType: "approver",
      userId: approverId,
      at: approvedAt,
      canStamp: ["admin", "super_admin"].includes(userRole),
      requiredRole: "管理者",
    },
    {
      label: "確　認",
      stampType: "reviewer",
      userId: reviewerId,
      at: reviewedAt,
      canStamp: ["manager", "admin", "super_admin"].includes(userRole),
      requiredRole: "上長・管理者",
    },
    {
      label: "担　当",
      stampType: "person_in_charge",
      userId: personInChargeId,
      at: personInChargeConfirmedAt,
      canStamp: ["staff", "manager", "admin", "super_admin", "member"].includes(userRole),
      requiredRole: "スタッフ以上",
    },
  ];

  // 未押印で権限あり → pending (ハッチ背景)
  const pendingLabels = stamps
    .filter(s => !s.at && s.canStamp)
    .map(s => {
      const u = stampUsers.find(u => u.id === s.userId);
      return u ? u.full_name : null;
    })
    .filter(Boolean);

  return (
    <div style={{
      padding: 14,
      background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      borderRadius: "var(--r-lg)",
      marginTop: 12,
      position: "relative",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--c-text-muted)",
        letterSpacing: "0.06em", textTransform: "uppercase" as const,
        marginBottom: 10,
      }}>
        印影プレビュー（帳票出力時に自動配置）
      </div>

      {/* スタンプフレームグリッド */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid #999" }}>
        {stamps.map(({ label, stampType, userId, at, canStamp, requiredRole }, i) => {
          const stampedUser = stampUsers.find(u => u.id === userId);
          const isStamped = !!at;
          const isActive = stampTarget === stampType;
          const isPendingMine = !isStamped && canStamp;

          return (
            <div
              key={stampType}
              style={{
                borderRight: i < stamps.length - 1 ? "1px solid #999" : "none",
                display: "flex", flexDirection: "column", alignItems: "center",
                position: "relative",
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

              {/* 押印エリア */}
              <div
                onClick={() => {
                  if (!canStamp) {
                    showMsg(`「${label.replace(/\s/g, "")}」押印には${requiredRole}の権限が必要です`);
                    return;
                  }
                  if (isStamped) {
                    if (confirm(`「${label.replace(/\s/g, "")}」の押印を取り消しますか？`)) {
                      handleStamp(stampType, userId!, false);
                    }
                  } else {
                    setStampTarget(isActive ? null : stampType);
                  }
                }}
                style={{
                  width: "100%", height: 80,
                  display: "grid", placeItems: "center",
                  cursor: canStamp ? "pointer" : "default",
                  background: isPendingMine
                    ? "repeating-linear-gradient(45deg, var(--c-warn-bg), var(--c-warn-bg) 6px, transparent 6px, transparent 12px)"
                    : isActive
                    ? "color-mix(in oklab, var(--c-primary) 5%, var(--c-surface))"
                    : "var(--c-surface)",
                  transition: "background 0.15s",
                }}
                title={canStamp
                  ? isStamped ? "クリックで取り消し" : "クリックして押印"
                  : `${requiredRole}の権限が必要です`}
              >
                {isStamped && stampedUser ? (
                  <div style={{ textAlign: "center" }}>
                    {/* 丸印影 */}
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
                      {new Date(at!).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                    </div>
                  </div>
                ) : isPendingMine ? (
                  <span style={{ fontSize: 10, color: "var(--c-warn)", fontWeight: 600 }}>押印</span>
                ) : (
                  <span style={{ fontSize: 9, color: "var(--c-text-subtle)", textAlign: "center", lineHeight: 1.4, padding: "0 4px" }}>
                    {requiredRole}
                  </span>
                )}
              </div>

              {/* ユーザー選択ドロップダウン */}
              {isActive && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setStampTarget(null)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
                    minWidth: 160, zIndex: 100,
                    background: "var(--c-surface)", border: "1px solid var(--c-border)",
                    borderRadius: "var(--r-md)", boxShadow: "var(--sh-pop)", maxHeight: 200, overflowY: "auto",
                  }}>
                    <div style={{ padding: "6px 10px", fontSize: 10, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>
                      押印者を選択
                    </div>
                    {stampUsers.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 11, color: "var(--c-text-muted)", textAlign: "center" }}>
                        読込中...
                      </div>
                    ) : stampUsers.map(u => (
                      <div
                        key={u.id}
                        onMouseDown={() => handleStamp(stampType, u.id, true)}
                        style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--c-surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {u.full_name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ステータスメモ */}
      <div style={{ fontSize: 10, color: "var(--c-text-muted)", textAlign: "center", marginTop: 6, fontFamily: "var(--ff-mono)" }}>
        {stampLoading ? "押印中..." :
          stamps.every(s => s.at) ? "全員承認済み" :
          stamps.some(s => s.at) ? `${stamps.filter(s => s.at).length} / ${stamps.length} 承認済み` :
          "押印してください"}
      </div>
    </div>
  );
}
