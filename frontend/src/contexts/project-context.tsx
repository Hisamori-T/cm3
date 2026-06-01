"use client";

import { createContext, useContext } from "react";
import type { ProjectStatus } from "@/types/project";

export interface ProjectCounts {
  qcds: number;
  estimate: number;
  quote: number;
  order: number;
  acknowledgment: number;
  invoice: number;
  progress: number;
  history: number;
}

export interface ProjectSubNavContextValue {
  projectId: string;
  projectNumber: string;
  projectName: string;
  status: ProjectStatus;
  counts: ProjectCounts;
}

export const ProjectSubNavContext = createContext<ProjectSubNavContextValue | null>(null);

export function useProjectSubNav() {
  return useContext(ProjectSubNavContext);
}
