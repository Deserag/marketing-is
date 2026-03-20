import { PaginatedResponse } from '../../entity/common/pagination.models';
import { UserProfile } from '../../entity/auth/auth.models';
import { CompanyListItem } from '../../entity/company/company.models';
import { EventListItem } from '../../entity/event/event.models';
import { ExpenseListItem } from '../../entity/expense/expense.models';
import { ProjectListItem } from '../../entity/project/project.models';

export interface DashboardViewModel {
  profile: UserProfile;
  projects: PaginatedResponse<ProjectListItem>;
  events: PaginatedResponse<EventListItem>;
  companies: PaginatedResponse<CompanyListItem>;
  expenses: PaginatedResponse<ExpenseListItem>;
}
