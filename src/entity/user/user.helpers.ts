import { UserListItem } from './user.models';

type UserIdentity = Pick<
  UserListItem,
  'lastName' | 'firstName' | 'middleName' | 'login' | 'email'
>;

export function formatUserFullName(user: UserIdentity): string {
  const fullName = [user.lastName, user.firstName, user.middleName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return fullName || user.login || user.email || 'Пользователь без имени';
}

export function buildUserSearchTerms(user: UserIdentity): string[] {
  return [formatUserFullName(user), user.login, user.email]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value);
}
