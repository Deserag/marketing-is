import { PaginatedResponse } from '../common/pagination.models';
import { UserRole } from '../auth/auth.models';

export type ExpenseSourceType = 'PROJECT' | 'EVENT';

export interface ExpenseListQuery {
  page?: number;
  size?: number;
  search?: string;
  sourceType?: ExpenseSourceType;
  eventId?: string;
  projectId?: string;
  type?: string;
  currency?: string;
  approved?: boolean;
  dateFrom?: string;
  dateTo?: string;
  initiatorId?: string;
}

export interface ExpenseListItem {
  id: string;
  sourceType: ExpenseSourceType;
  source: {
    id: string;
    name: string;
    route: string;
    type?: string | null;
  };
  name: string;
  description?: string | null;
  type: string;
  amount: string | number;
  currency: string;
  spentAt: string;
  approved: boolean | null;
  initiator: {
    id: string;
    login: string;
    email: string;
    role: UserRole;
    lastName: string;
    firstName: string;
    middleName?: string | null;
  };
}

export interface ExpenseListSummary {
  totalBySource: {
    projects: number;
    events: number;
  };
  totalByCurrency: Array<{
    currency: string;
    total: string;
    count: number;
  }>;
  pendingApproval: number;
}

export interface ExpenseListResponse extends PaginatedResponse<ExpenseListItem> {
  summary: ExpenseListSummary;
}
