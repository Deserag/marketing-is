import { UserRole } from '../entity/auth/auth.models';

export interface AccessPolicy {
  canAccessAdminPanel: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canViewFinance: boolean;
  assignableUserRoles: UserRole[];
}

const ALL_USER_ROLES: UserRole[] = [
  'SUPERADMIN',
  'ADMIN',
  'MARKETER',
  'MANAGER',
  'EMPLOYEE',
];

export function buildAccessPolicy(role: UserRole | null | undefined): AccessPolicy {
  switch (role) {
    case 'SUPERADMIN':
    case 'ADMIN':
      return {
        canAccessAdminPanel: true,
        canViewUsers: true,
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canViewFinance: true,
        assignableUserRoles: ALL_USER_ROLES,
      };
    case 'MARKETER':
      return {
        canAccessAdminPanel: false,
        canViewUsers: true,
        canCreateUsers: true,
        canEditUsers: false,
        canDeleteUsers: false,
        canViewFinance: true,
        assignableUserRoles: ['MANAGER', 'EMPLOYEE'],
      };
    case 'MANAGER':
    case 'EMPLOYEE':
      return {
        canAccessAdminPanel: false,
        canViewUsers: true,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canViewFinance: false,
        assignableUserRoles: [],
      };
    default:
      return {
        canAccessAdminPanel: false,
        canViewUsers: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canViewFinance: false,
        assignableUserRoles: [],
      };
  }
}
