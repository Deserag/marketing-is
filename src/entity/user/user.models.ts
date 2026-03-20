import { UserProfile, UserRole } from '../auth/auth.models';

export interface UserListItem extends UserProfile {}

export interface CreateUserPayload {
  login: string;
  email: string;
  password: string;
  role: UserRole;
  lastName: string;
  firstName: string;
  middleName?: string;
}

export interface UpdateUserPayload {
  login?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
}
