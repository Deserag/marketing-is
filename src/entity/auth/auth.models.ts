export type UserRole =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'MARKETER'
  | 'MANAGER'
  | 'EMPLOYEE';

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface AuthTokenResponse {
  token: string;
}

export interface AuthTokenPayload {
  sub: string;
  login: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface UserProfile {
  id: string;
  login: string;
  email: string;
  role: UserRole;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'SUPERADMIN' || role === 'ADMIN';
}
