"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useProjectSubNav } from "@/contexts/project-context";
import { ProjectSubNav } from "@/components/project/ProjectSubNav";
import { apiFetch } from "@/lib/api-client";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  badgeColor?: string;
  adminOnly?: boolean;
}

interface AppShellProps {
  children: ReactNode;
  /** パンくずリスト: [{label, href?}] */
  breadcrumbs?: { label: string; href?: string }[];
  /** トップバー右端に置くアクションボタン */
  action?: ReactNode;
}

const NAV_MAIN: NavItem[] = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 12L12 4l9 8M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "案件一覧",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 5h18M3 12h18M3 19h18" />
      </svg>
    ),
  },
];

const NAV_WORK: NavItem[] = [
  {
    href: "/projects/kanban",
    label: "カンバン",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="3" width="5" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="10" rx="1" />
      </svg>
    ),
  },
  {
    href: "/gantt",
    label: "全社工程表",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="3" y1="6" x2="15" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="11" y2="18" />
      </svg>
    ),
  },
  {
    href: "/daily-report",
    label: "日報",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="7" y1="9" x2="17" y2="9" />
        <line x1="7" y1="13" x2="13" y2="13" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "カレンダー",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/approvals",
    label: "承認待ち",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <path d="M22 4L12 14.01l-3-3"/>
      </svg>
    ),
  },
  {
    href: "/purchases",
    label: "発注管理",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/vendors",
    label: "業者マスタ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" />
      </svg>
    ),
  },
  {
    href: "/clients",
    label: "顧客マスタ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

const NAV_ADMIN: NavItem[] = [
  {
    href: "/admin",
    label: "管理者設定",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    adminOnly: true,
  },
];

/** ナビリンク1件。アクティブ判定付き。 */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={`nav-item ${isActive ? "active" : ""}`}
    >
      {item.icon}
      {item.label}
      {item.badge != null && (
        <span
          className="nav-badge"
          style={item.badgeColor ? { background: item.badgeColor, color: "#fff" } : undefined}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/** サイドバー付きアプリシェル。認証チェック込み。 */
export function AppShell({ children, breadcrumbs, action }: AppShellProps) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const projectSubNav = useProjectSubNav();
  const [companyName, setCompanyName] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("cmv3_company_name")) || "株式会社クラップ"
  );
  const [companyNameEn, setCompanyNameEn] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("cmv3_company_name_en")) || "CL"
  );
  const [logoText, setLogoText] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("cmv3_logo_text")) || ""
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string | null; is_read: boolean; created_at: string; related_type: string | null; related_id: string | null }[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = () => {
      apiFetch<{ company_name: string; company_name_en: string | null; logo_text: string | null }>("/api/v1/company-settings")
        .then((d) => {
          if (d.company_name) {
            setCompanyName(d.company_name);
            localStorage.setItem("cmv3_company_name", d.company_name);
          }
          const en = d.company_name_en ?? "";
          setCompanyNameEn(en);
          localStorage.setItem("cmv3_company_name_en", en);
          const lt = d.logo_text ?? "";
          setLogoText(lt);
          localStorage.setItem("cmv3_logo_text", lt);
        })
        .catch(() => {});
    };
    fetchSettings();
    window.addEventListener("companySettingsUpdated", fetchSettings);
    return () => window.removeEventListener("companySettingsUpdated", fetchSettings);
  }, [user]);

  // 通知ポーリング（30秒ごと）
  useEffect(() => {
    if (!user) return;
    const fetchNotifCount = () => {
      apiFetch<{ count: number }>("/api/v1/notifications/unread-count")
        .then(d => setUnreadCount(d.count))
        .catch(() => {});
    };
    fetchNotifCount();
    const timer = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(timer);
  }, [user]);

  const openNotifPanel = async () => {
    setNotifOpen(v => !v);
    if (!notifOpen) {
      const rows = await apiFetch<typeof notifs>("/api/v1/notifications").catch(() => []);
      setNotifs(rows);
      if (rows.some(r => !r.is_read)) {
        apiFetch("/api/v1/notifications/read-all", { method: "PATCH" }).then(() => setUnreadCount(0)).catch(() => {});
      }
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  if (isLoading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--c-bg)" }}
      >
        <p style={{ color: "var(--c-text-muted)", fontSize: "var(--fs-sm)" }}>読み込み中...</p>
      </div>
    );
  }

  const initials = user.full_name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div className="app">
      {/* ===== Sidebar ===== */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="logo-mark">
            {logoText.trim().toUpperCase() ||
              companyNameEn.trim().slice(0, 2).toUpperCase() ||
              companyName.replace(/[株式会社（）【】\s]/g, "").slice(0, 2) ||
              "CL"}
          </div>
          <div className="brand">
            Construction Mgr
            <small>{companyName}</small>
          </div>
        </div>

        <div className="sidebar-section">
          {NAV_MAIN.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">作業</div>
          {NAV_WORK.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {(["admin", "super_admin"].some(r => user.roles?.includes(r as never) || user.role === r)) && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">設定</div>
            {NAV_ADMIN.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        <div className="sidebar-foot">
          <Link href="/profile" style={{ display: "contents" }} title="プロフィール編集">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              {user.full_name}
              <small>
                {user.department ?? (
                  user.role === "super_admin" ? "システム管理者"
                  : user.role === "admin" ? "管理者"
                  : "メンバー"
                )}
              </small>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="ログアウト"
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--c-text-muted)",
              padding: "4px",
              borderRadius: "var(--r-md)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div className="main">
        <header className="topbar">
          <div className="crumbs">
            {breadcrumbs?.map((crumb, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span className="sep">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} style={{ color: "var(--c-text-muted)", textDecoration: "none" }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <strong>{crumb.label}</strong>
                )}
              </span>
            ))}
          </div>
          <div className="topbar-spacer" />
          {action}
          {/* 通知ベルアイコン */}
          <div style={{ position: "relative", marginLeft: 8 }}>
            <button
              onClick={openNotifPanel}
              style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: 4, color: "var(--c-text-muted)", display: "flex", alignItems: "center" }}
              title="通知"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: 0, right: 0,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "var(--c-danger)", color: "#fff",
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
            {notifOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setNotifOpen(false)} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 100,
                  width: 340, background: "var(--c-surface)", border: "1px solid var(--c-border)",
                  borderRadius: "var(--r-lg)", boxShadow: "0 8px 24px rgba(0,0,0,.15)",
                  maxHeight: 420, overflow: "hidden", display: "flex", flexDirection: "column",
                }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--c-border)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    通知
                    <a href="/approvals" style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-primary)", textDecoration: "none" }}>承認待ち一覧 →</a>
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "var(--c-text-muted)" }}>通知はありません</div>
                    ) : notifs.map(n => (
                      <div key={n.id}
                        onClick={() => {
                          if (n.related_type === "approval_request") {
                            setNotifOpen(false);
                            router.push("/approvals");
                          }
                        }}
                        style={{
                          padding: "10px 14px", borderBottom: "1px solid var(--c-border)",
                          background: n.is_read ? "transparent" : "color-mix(in oklab,var(--c-primary) 5%,var(--c-surface))",
                          fontSize: 12,
                          cursor: n.related_type === "approval_request" ? "pointer" : "default",
                        }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                        {n.body && <div style={{ color: "var(--c-text-muted)", fontSize: 11, lineHeight: 1.4 }}>{n.body}</div>}
                        <div style={{ color: "var(--c-text-subtle)", fontSize: 10, marginTop: 4 }}>{new Date(n.created_at).toLocaleString("ja-JP")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {projectSubNav && (
          <div style={{ padding: "20px 22px 0" }}>
            <ProjectSubNav
              projectId={projectSubNav.projectId}
              projectNumber={projectSubNav.projectNumber}
              projectName={projectSubNav.projectName}
              status={projectSubNav.status}
              counts={projectSubNav.counts}
            />
          </div>
        )}
        <main className="page" style={projectSubNav ? { paddingTop: 0 } : undefined}>{children}</main>
      </div>
    </div>
  );
}
