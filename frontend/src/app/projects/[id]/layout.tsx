"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";
import { ProjectSubNavContext } from "@/contexts/project-context";
import type { ProjectSubNavContextValue } from "@/contexts/project-context";
import type { ProjectStatus } from "@/types/project";

interface ProjectDetailMin {
  project_number: string;
  project_name: string;
  status: ProjectStatus;
  counts: {
    qcds: number;
    estimate: number;
    quote: number;
    order: number;
    acknowledgment: number;
    invoice: number;
    progress: number;
    history: number;
  };
}

/** 案件サブナビ共通レイアウト。全 /projects/[id]/* サブルートに自動適用。 */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [ctx, setCtx] = useState<ProjectSubNavContextValue | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<ProjectDetailMin>(`/api/v1/projects/${id}`)
      .then((data) => {
        setCtx({
          projectId: id,
          projectNumber: data.project_number,
          projectName: data.project_name,
          status: data.status,
          counts: data.counts,
        });
      })
      .catch(() => {
        // 認証前など失敗しても subnav なしで続行
      });
  }, [id]);

  return (
    <ProjectSubNavContext.Provider value={ctx}>
      {children}
    </ProjectSubNavContext.Provider>
  );
}
