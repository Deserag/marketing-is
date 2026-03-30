export type ExpenseType = 'ADVERTISING' | 'RENT' | 'CONTENT' | 'OTHER';
export type Currency = 'RUB' | 'USD' | 'EUR';

export interface ProjectListItem {
  id: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  result?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    participants: number;
    sprints: number;
    expenses: number;
  };
  resultFile?: {
    id: string;
    name: string;
    path?: string;
    size?: number;
    downloadUrl: string;
  } | null;
}

export interface ProjectParticipant {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    login: string;
    email: string;
    role: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
  };
}

export interface ProjectSprint {
  id: string;
  projectId: string;
  taskText: string;
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  taskFile?: {
    id: string;
    name: string;
    path?: string;
    size?: number;
    downloadUrl: string;
  } | null;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  initiatorId: string;
  name: string;
  description?: string | null;
  type: ExpenseType;
  amount: string;
  currency: Currency;
  spentAt: string;
  createdAt: string;
  updatedAt: string;
  initiator: {
    id: string;
    login: string;
    email: string;
    role: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
  };
}

export interface ProjectDetails extends Omit<ProjectListItem, '_count'> {
  participants: ProjectParticipant[];
  sprints: ProjectSprint[];
  expenses: ProjectExpense[];
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  goal?: string;
  result?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  goal?: string | null;
  result?: string | null;
}

export interface CreateProjectParticipantPayload {
  userId: string;
  role: string;
}

export interface AddProjectParticipantsPayload {
  userIds: string[];
  role: string;
}

export interface UpdateProjectParticipantPayload {
  userId?: string;
  role?: string;
}

export interface CreateProjectSprintPayload {
  taskText: string;
  startDate: string;
  endDate?: string;
}

export interface UpdateProjectSprintPayload {
  taskText?: string;
  startDate?: string;
  endDate?: string | null;
}

export interface CreateProjectExpensePayload {
  name: string;
  description?: string;
  type: ExpenseType;
  amount: number;
  currency: Currency;
  spentAt: string;
}

export interface UpdateProjectExpensePayload {
  name?: string;
  description?: string | null;
  type?: ExpenseType;
  amount?: number;
  currency?: Currency;
  spentAt?: string;
}
