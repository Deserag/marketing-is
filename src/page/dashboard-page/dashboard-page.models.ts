import { CompanyListItem } from '../../entity/company/company.models';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import { EventListItem } from '../../entity/event/event.models';
import { ExpenseListItem } from '../../entity/expense/expense.models';
import { ProjectListItem } from '../../entity/project/project.models';

export interface DashboardViewModel {
  projects: PaginatedResponse<ProjectListItem>;
  events: PaginatedResponse<EventListItem>;
  companies: PaginatedResponse<CompanyListItem>;
  expenses: PaginatedResponse<ExpenseListItem>;
}
