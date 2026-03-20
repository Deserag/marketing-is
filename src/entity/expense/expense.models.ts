import { UserRole } from '../auth/auth.models';

export interface ExpenseListItem {
  id: string;
  name: string;
  type: string;
  price: string | number;
  currency: string;
  approved: boolean;
  createdAt: string;
  event: {
    id: string;
    name: string;
  };
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
