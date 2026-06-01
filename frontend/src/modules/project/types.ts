/**
 * Project モジュール: 型定義 re-export。
 *
 * 実体は src/types/project.ts にある。
 * 将来的にこのファイルに実体を移動する。
 */
export type {
  ProjectStatus,
  ProjectListItem,
  ProjectListResponse,
  ProjectCreate,
  ProjectUpdate,
  ProjectDetail,
} from "@/types/project";

export {
  PROJECT_STATUS_LABEL,
  PREV_CONSTRUCTION_LABEL,
} from "@/types/project";
