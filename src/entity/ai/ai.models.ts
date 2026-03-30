export interface AiOverview {
  totals: {
    companies: number;
    users: number;
    projects: number;
    events: number;
    projectExpenses: string;
    eventExpenses: string;
  };
  usersByRole: Array<{
    role: string;
    count: number;
  }>;
  projectExpensesByType: Array<{
    type: string;
    currency: string;
    count: number;
    total: string;
  }>;
  eventExpensesByType: Array<{
    type: string;
    currency: string;
    count: number;
    total: string;
  }>;
  recentProjects: Array<{
    id: string;
    name: string;
    goal?: string | null;
    result?: string | null;
    updatedAt: string;
    participantsCount: number;
    sprintsCount: number;
    expensesCount: number;
  }>;
  upcomingEvents: Array<{
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate?: string | null;
    responsible: {
      id: string;
      firstName: string;
      lastName: string;
    };
    participantsCount: number;
  }>;
}

export interface AiCard {
  id: string;
  name: string;
  createdAt: string;
  kind: 'project' | 'report' | 'note' | string;
  content: Record<string, unknown>;
}

export interface AiChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface AiChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export interface AiChatDetail {
  id: string;
  title: string;
  createdAt: string;
  messages: AiChatMessage[];
}

export interface CreateAiChatPayload {
  title?: string;
}

export interface SendAiMessagePayload {
  message: string;
}

export interface SaveAiMessagePayload {
  name?: string;
  kind?: 'project' | 'report' | 'note';
}
