import { UserRole } from '../entity/auth/auth.models';

export interface AccessPolicy {
  canAccessAdminPanel: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageCompanies: boolean;
  canCreateProjects: boolean;
  canManageProjects: boolean;
  canCreateEvents: boolean;
  canManageAllEvents: boolean;
  canDeleteEvents: boolean;
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
      return {
        canAccessAdminPanel: true,
        canViewUsers: true,
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canManageCompanies: true,
        canCreateProjects: true,
        canManageProjects: true,
        canCreateEvents: true,
        canManageAllEvents: true,
        canDeleteEvents: true,
        canViewFinance: true,
        assignableUserRoles: ALL_USER_ROLES,
      };
    case 'ADMIN':
      return {
        canAccessAdminPanel: true,
        canViewUsers: true,
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canManageCompanies: true,
        canCreateProjects: true,
        canManageProjects: true,
        canCreateEvents: true,
        canManageAllEvents: true,
        canDeleteEvents: true,
        canViewFinance: true,
        assignableUserRoles: ['ADMIN', 'MARKETER', 'MANAGER', 'EMPLOYEE'],
      };
    case 'MARKETER':
      return {
        canAccessAdminPanel: false,
        canViewUsers: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canManageCompanies: true,
        canCreateProjects: true,
        canManageProjects: true,
        canCreateEvents: true,
        canManageAllEvents: true,
        canDeleteEvents: true,
        canViewFinance: true,
        assignableUserRoles: [],
      };
    case 'MANAGER':
      return {
        canAccessAdminPanel: false,
        canViewUsers: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canManageCompanies: false,
        canCreateProjects: true,
        canManageProjects: true,
        canCreateEvents: false,
        canManageAllEvents: false,
        canDeleteEvents: false,
        canViewFinance: false,
        assignableUserRoles: [],
      };
    case 'EMPLOYEE':
      return {
        canAccessAdminPanel: false,
        canViewUsers: false,
        canCreateUsers: false,
        canEditUsers: false,
        canDeleteUsers: false,
        canManageCompanies: false,
        canCreateProjects: false,
        canManageProjects: false,
        canCreateEvents: false,
        canManageAllEvents: false,
        canDeleteEvents: false,
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
        canManageCompanies: false,
        canCreateProjects: false,
        canManageProjects: false,
        canCreateEvents: false,
        canManageAllEvents: false,
        canDeleteEvents: false,
        canViewFinance: false,
        assignableUserRoles: [],
      };
  }
}
