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
    href: "/admin/users",
    label: "ユーザー管理",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/import",
    label: "Excelインポート",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/company",
    label: "自社情報設定",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
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

        {(user.role === "admin" || user.role === "super_admin") && (
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
