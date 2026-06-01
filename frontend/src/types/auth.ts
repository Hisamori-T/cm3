/** 認証・ユーザー関連の型定義。 */

export type UserRole = "super_admin" | "admin" | "staff" | "legacy" | "accounting" | "member";

export interface User {
  id: string;
  email: string;
  full_name: string;
  employee_number: number | null;
  role: UserRole;
  department: string | null;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
