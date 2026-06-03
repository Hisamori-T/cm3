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
// Component
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
  // 右から担当・確認・承認の順（表示は左から 承認・確認・担当）
  const stamps: {
    label: string;
    stampType: StampType;
    userId: string | null;
    at: string | null;
    canStamp: boolean;
    requiredRole: string;
  }[] = [
    {
      label: "承認",
      stampType: "approver",
      userId: approverId,
      at: approvedAt,
      canStamp: ["admin", "super_admin"].includes(userRole),
      requiredRole: "管理者",
    },
    {
      label: "確認",
      stampType: "reviewer",
      userId: reviewerId,
      at: reviewedAt,
      canStamp: ["manager", "admin", "super_admin"].includes(userRole),
      requiredRole: "上長・管理者",
    },
    {
      label: "担当",
      stampType: "person_in_charge",
      userId: personInChargeId,
      at: personInChargeConfirmedAt,
      canStamp: ["staff", "manager", "admin", "super_admin", "member"].includes(userRole),
      requiredRole: "スタッフ以上",
    },
  ];

  return (
    <div className="card" style={{ padding: "10px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--c-text-muted)" }}>稟議承認</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {stamps.map(({ label, stampType, userId, at, canStamp, requiredRole }) => {
          const stampedUser = stampUsers.find(u => u.id === userId);
          const isStamped = !!at;
          const isActive = stampTarget === stampType;
          return (
            <div key={stampType} style={{ position: "relative", textAlign: "center" }}>
              {/* スタンプ枠 */}
              <div style={{
                border: `1.5px solid ${isStamped ? "#C00000" : isActive ? "var(--c-primary)" : "var(--c-border)"}`,
                borderRadius: "var(--r-md)", padding: "6px 4px",
                opacity: canStamp ? 1 : 0.65,
              }}>
                <div style={{ fontSize: 10, color: "var(--c-text-muted)", marginBottom: 4 }}>{label}</div>
                <div
                  onClick={() => {
                    if (!canStamp) {
                      showMsg(`「${label}」押印には${requiredRole}の権限が必要です`);
                      return;
                    }
                    if (isStamped) {
                      if (confirm(`「${label}」の押印を取り消しますか？`)) {
                        handleStamp(stampType, userId!, false);
                      }
                    } else {
                      setStampTarget(isActive ? null : stampType);
                    }
                  }}
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    border: `2px solid ${isStamped ? "#C00000" : "var(--c-border)"}`,
                    borderStyle: canStamp ? "solid" : "dashed",
                    margin: "0 auto",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    background: isStamped ? "color-mix(in oklab, #C00000 8%, white)" : "transparent",
                  }}
                  title={canStamp ? (isStamped ? "クリックで取り消し" : "クリックして押印") : `${requiredRole}の権限が必要です`}
                >
                  {isStamped && stampedUser ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C00000", lineHeight: 1 }}>
                      {stampedUser.full_name.split(/[\s　]/)[0].slice(0, 3)}
                    </span>
                  ) : canStamp ? (
                    <span style={{ fontSize: 9, color: "var(--c-text-muted)" }}>押印</span>
                  ) : (
                    <span style={{ fontSize: 8, color: "var(--c-text-muted)", lineHeight: 1.2, textAlign: "center" }}>
                      {requiredRole}
                    </span>
                  )}
                </div>
                {isStamped && stampedUser && (
                  <div style={{ fontSize: 8, color: "#C00000", marginTop: 3, fontWeight: 600 }}>
                    {stampedUser.full_name}
                  </div>
                )}
                {at && (
                  <div style={{ fontSize: 8, color: "var(--c-text-muted)", marginTop: 1 }}>
                    {new Date(at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </div>
                )}
              </div>
              {/* ユーザー選択ドロップダウン */}
              {isActive && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setStampTarget(null)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
                    minWidth: 140,
                    zIndex: 100, background: "var(--c-surface)",
                    border: "1px solid var(--c-border)", borderRadius: "var(--r-md)",
                    boxShadow: "0 8px 24px rgba(0,0,0,.15)", maxHeight: 200, overflowY: "auto",
                  }}>
                    <div style={{ padding: "6px 10px", fontSize: 10, color: "var(--c-text-muted)", borderBottom: "1px solid var(--c-border)" }}>
                      押印者を選択
                    </div>
                    {stampUsers.length === 0 ? (
                      <div style={{ padding: "10px", fontSize: 11, color: "var(--c-text-muted)", textAlign: "center" }}>
                        ユーザー読込中...
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
      {stampLoading && (
        <div style={{ fontSize: 10, color: "var(--c-text-muted)", textAlign: "center", marginTop: 6 }}>押印中...</div>
      )}
    </div>
  );
}
