import { UserRole } from '../auth/auth.models';

export interface EventListQuery {
  page?: number;
  size?: number;
  search?: string;
  type?: string;
}

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

export interface EventParticipant {
  id: string;
  eventId: string;
  companyEmployeeId: string;
  createdAt: string;
  updatedAt: string;
  companyEmployee: {
    id: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    email?: string | null;
    phone?: string | null;
    vk?: string | null;
    telegram?: string | null;
    company: {
      id: string;
      name: string;
      inn: string;
      kpp?: string | null;
    };
  };
}

export interface EventExpense {
  id: string;
  eventId: string;
  initiatorId: string;
  name: string;
  type: string;
  price: string | number;
  currency: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  initiator: EventListItem['responsible'];
}

export interface EventMetric {
  id: string;
  eventId: string;
  leads?: number | null;
  sales?: number | null;
  revenue?: string | number | null;
  createdAt: string;
}

export interface EventReminder {
  id: string;
  eventId: string;
  remindBeforeHours: number;
  createdAt: string;
}

export interface EventDetails extends Omit<EventListItem, 'participantsCount' | 'expensesCount' | 'metricsCount' | 'remindersCount'> {
  participants: EventParticipant[];
  expenses: EventExpense[];
  metrics: EventMetric[];
  reminders: EventReminder[];
}
