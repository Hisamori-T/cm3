/**
 * 案件ヘッダー + サブナビ。ハンドオフデザイン準拠 (.proj-header / .proj-subnav)
 *
 * 移行先: src/modules/project/ProjectSubNav.tsx
 * 旧パス: src/components/project/ProjectSubNav.tsx（後方互換 re-export を維持）
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProjectCounts } from "@/contexts/project-context";
import type { ProjectStatus } from "@/types/project";

const STATUS_CLASS: Record<ProjectStatus, string> = {
  quote: "s-quote", ordered: "s-order", started: "s-start",
  in_progress: "s-progress", completed: "s-done", billed: "s-billed", paid: "s-paid",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  quote: "見積中", ordered: "受注", started: "着工",
  in_progress: "施工中", completed: "完工", billed: "請求済", paid: "入金済",
};

interface Tab {
  href: string;
  label: string;
  countKey: keyof ProjectCounts | null;
}

function getTabs(projectId: string): Tab[] {
  return [
    { href: `/projects/${projectId}`,               label: "詳細",    countKey: null },
    { href: `/projects/${projectId}/ledger`,          label: "工事台帳", countKey: null },
    { href: `/projects/${projectId}/qcds`,           label: "QCDS",    countKey: "qcds" },
    { href: `/projects/${projectId}/estimate`,       label: "業者見積", countKey: "estimate" },
    { href: `/projects/${projectId}/quote`,          label: "顧客見積", countKey: "quote" },
    { href: `/projects/${projectId}/order`,          label: "注文書",   countKey: "order" },
    { href: `/projects/${projectId}/acknowledgment`, label: "注文請書", countKey: "acknowledgment" },
    { href: `/projects/${projectId}/invoice`,        label: "請求書",   countKey: "invoice" },
    { href: `/projects/${projectId}/progress`,       label: "進捗",     countKey: "progress" },
    { href: `/projects/${projectId}/gantt`,          label: "工程表",   countKey: null },
    { href: `/projects/${projectId}/attendance`,     label: "出面",     countKey: null },
    { href: `/projects/${projectId}/photo-album`,    label: "写真台帳", countKey: null },
    { href: `/projects/${projectId}/purchase`,       label: "発注書",   countKey: null },
    { href: `/projects/${projectId}/history`,        label: "編集履歴", countKey: "history" },
  ];
}

interface ProjectSubNavProps {
  projectId: string;
  projectNumber: string;
  projectName: string;
  status: ProjectStatus;
  counts: ProjectCounts;
}

export function ProjectSubNav({ projectId, projectNumber, projectName, status, counts }: ProjectSubNavProps) {
  const pathname = usePathname();
  const tabs = getTabs(projectId);

  const isActive = (href: string) => {
    if (href === `/projects/${projectId}`) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="proj-header">
      <div className="ph-top">
        <Link href="/projects" className="crumb">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          案件一覧
        </Link>
        <span className="pn">{projectNumber}</span>
        <h1>{projectName}</h1>
        <span className={`badge ${STATUS_CLASS[status]}`} style={{ fontSize: 10, padding: "1px 7px 1px 5px" }}>
          <span className="dot" />
          {STATUS_LABEL[status]}
        </span>
        <span className="spacer" />
      </div>

      <nav className="proj-subnav">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const count = tab.countKey != null ? counts[tab.countKey] : null;
          const zero = count === 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab${active ? " on" : ""}${zero ? " zero" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              {count != null && (
                <span className="ct">{count}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
