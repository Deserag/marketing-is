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
