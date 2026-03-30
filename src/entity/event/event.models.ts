import { UserRole } from '../auth/auth.models';

export interface EventListQuery {
  page?: number;
  size?: number;
  search?: string;
  type?: string;
  responsibleId?: string;
  mine?: boolean;
  startDate?: string;
  endDate?: string;
}

export type EventType = 'WEBINAR' | 'MEETING' | 'CAMPAIGN';

export interface EventListItem {
  id: string;
  name: string;
  type: EventType;
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
  schedule?: {
    hasExplicitEnd: boolean;
    durationMinutes: number | null;
    isMultiDay: boolean;
  };
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    login: string;
    email: string;
    role: UserRole;
    lastName: string;
    firstName: string;
    middleName?: string | null;
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

export interface EventDetails
  extends Omit<
    EventListItem,
    'participantsCount' | 'expensesCount' | 'metricsCount' | 'remindersCount'
  > {
  participants: EventParticipant[];
  expenses: EventExpense[];
  metrics: EventMetric[];
  reminders: EventReminder[];
}

export interface CreateEventPayload {
  name: string;
  type: EventType;
  startDate: string;
  endDate?: string;
  description?: string;
  responsibleId?: string;
  participants?: string[];
}

export interface UpdateEventPayload {
  name?: string;
  type?: EventType;
  startDate?: string;
  endDate?: string | null;
  description?: string | null;
  responsibleId?: string;
  participants?: string[];
}

export interface CreateEventExpensePayload {
  name: string;
  type: 'ADVERTISING' | 'RENT' | 'CONTENT' | 'OTHER';
  price: number;
  currency: 'RUB' | 'USD' | 'EUR';
}

export interface CreateEventMetricPayload {
  leads?: number;
  sales?: number;
  revenue?: number;
}

export interface CreateEventReminderPayload {
  remindBeforeHours: number;
}
