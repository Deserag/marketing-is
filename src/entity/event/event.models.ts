import { UserRole } from '../auth/auth.models';

export interface EventListItem {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  responsibleId: string;
  responsible: {
    id: string;
    login: string;
    email: string;
    role: UserRole;
    lastName: string;
    firstName: string;
    middleName?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  participantsCount: number;
  expensesCount: number;
  metricsCount: number;
  remindersCount: number;
}
