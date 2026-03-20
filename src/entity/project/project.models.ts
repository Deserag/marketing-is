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
  };
  resultFile?: {
    id: string;
    name: string;
    path?: string;
    size?: number;
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
  } | null;
}

export interface ProjectDetails extends Omit<ProjectListItem, '_count'> {
  participants: ProjectParticipant[];
  sprints: ProjectSprint[];
}
