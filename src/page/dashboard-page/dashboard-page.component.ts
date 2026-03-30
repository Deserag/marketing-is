import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, take } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import { CompaniesService } from '../../entity/company/company.service';
import { EventsService } from '../../entity/event/event.service';
import { ExpenseListItem } from '../../entity/expense/expense.models';
import { ExpensesService } from '../../entity/expense/expense.service';
import { ProjectsService } from '../../entity/project/project.service';
import { formatUserFullName } from '../../entity/user/user.helpers';
import {
  MetricCardComponent,
  MetricTone,
} from '../../widget/metric-card/metric-card.component';
import { DashboardViewModel } from './dashboard-page.models';

type DashboardMetric = {
  label: string;
  value: number;
  hint: string;
  tone: MetricTone;
};

type ShortcutItem = {
  label: string;
  title: string;
  description: string;
  route: string;
};

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, MetricCardComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  private readonly authService = inject(AuthService);
  private readonly projectsService = inject(ProjectsService);
  private readonly eventsService = inject(EventsService);
  private readonly companiesService = inject(CompaniesService);
  private readonly expensesService = inject(ExpensesService);

  protected readonly access = this.authService.access;
  protected readonly dashboard = signal<DashboardViewModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly today = new Date();

  protected readonly metrics = computed<DashboardMetric[]>(() => {
    const dashboard = this.dashboard();

    if (!dashboard) {
      return [];
    }

    const metrics: DashboardMetric[] = [
      {
        label: 'Проекты',
        value: dashboard.projects.totalCount,
        hint: 'Рабочий пул активностей и проектных инициатив.',
        tone: 'teal',
      },
      {
        label: 'Мероприятия',
        value: dashboard.events.totalCount,
        hint: 'Запланированные маркетинговые события и встречи.',
        tone: 'amber',
      },
      {
        label: 'Компании',
        value: dashboard.companies.totalCount,
        hint: 'База клиентов и партнерских компаний.',
        tone: 'slate',
      },
    ];

    if (this.access().canViewFinance) {
      metrics.push({
        label: 'Расходы',
        value: dashboard.expenses.totalCount,
        hint: 'Финансовые заявки и контроль подтверждений.',
        tone: 'rose',
      });
    }

    return metrics;
  });

  protected readonly shortcuts = computed<ShortcutItem[]>(() => {
    const items: ShortcutItem[] = [
      {
        label: 'Проекты',
        title: 'Открыть проекты',
        description: 'Список инициатив, спринтов и проектных карточек.',
        route: '/projects',
      },
      {
        label: 'Мероприятия',
        title: 'Открыть мероприятия',
        description: 'Вебинары, встречи и маркетинговые активности.',
        route: '/events',
      },
      {
        label: 'Компании',
        title: 'Открыть компании',
        description: 'Контрагенты, партнеры и рабочая база компаний.',
        route: '/companies',
      },
      {
        label: 'Календарь',
        title: 'Открыть календарь',
        description: 'Сроки проектов, задач и ближайших мероприятий.',
        route: '/calendar',
      },
    ];

    if (this.access().canViewUsers) {
      items.push({
        label: 'Пользователи',
        title: 'Открыть пользователей',
        description: 'Сотрудники системы и рабочие роли.',
        route: '/users',
      });
    }

    if (this.access().canViewFinance) {
      items.push({
        label: 'Расходы',
        title: 'Открыть расходы',
        description: 'Регистрация расходов и сводный финансовый отчет.',
        route: '/expenses',
      });
    }

    if (this.access().canAccessAdminPanel) {
      items.push({
        label: 'Админка',
        title: 'Открыть админку',
        description: 'Управление системными данными и справочниками.',
        route: '/admin-panel',
      });
    }

    return items;
  });

  constructor() {
    this.loadDashboard();
  }

  protected reload(): void {
    this.loadDashboard();
  }

  protected eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type] ?? type;
  }

  protected approvalLabel(expense: ExpenseListItem): string {
    if (expense.approved === null) {
      return 'Без согласования';
    }

    return expense.approved ? 'Подтвержден' : 'Ожидает подтверждения';
  }

  protected expenseAmount(expense: ExpenseListItem): string {
    const amount = Number(expense.amount);

    if (!Number.isFinite(amount)) {
      return `${expense.amount} ${expense.currency}`;
    }

    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: expense.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected expenseSource(expense: ExpenseListItem): string {
    return `${expense.source.name} · ${formatUserFullName(expense.initiator)}`;
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .ensureCurrentProfile()
      .pipe(take(1))
      .subscribe({
        next: () => {
          const canViewFinance = this.authService.access().canViewFinance;

          forkJoin({
            projects: this.projectsService.list({ page: 1, size: 4 }),
            events: this.eventsService.list({ page: 1, size: 6 }),
            companies: this.companiesService.list({ page: 1, size: 6 }),
            expenses: canViewFinance
              ? this.expensesService.list({ page: 1, size: 5 })
              : of(this.emptyPage<ExpenseListItem>()),
          })
            .pipe(take(1))
            .subscribe({
              next: (data) => {
                this.dashboard.set(data);
                this.loading.set(false);
              },
              error: (error: unknown) => {
                this.loading.set(false);
                this.errorMessage.set(this.resolveErrorMessage(error));
              },
            });
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private emptyPage<T>() {
    return {
      rows: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      summary: {
        totalBySource: {
          projects: 0,
          events: 0,
        },
        totalByCurrency: [],
        pendingApproval: 0,
      },
    };
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000 и обновите страницу.';
    }

    return 'Не удалось загрузить главную страницу. Попробуйте обновить данные.';
  }
}
