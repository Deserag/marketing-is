import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of, take } from 'rxjs';
import { UserProfile } from '../../entity/auth/auth.models';
import { AuthService } from '../../entity/auth/auth.service';
import { CompaniesService } from '../../entity/company/company.service';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import { EventsService } from '../../entity/event/event.service';
import { ExpenseListItem } from '../../entity/expense/expense.models';
import { ExpensesService } from '../../entity/expense/expense.service';
import { ProjectsService } from '../../entity/project/project.service';
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

@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, MetricCardComponent],
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

  constructor() {
    this.loadDashboard();
  }

  protected reload(): void {
    this.loadDashboard();
  }

  protected logout(): void {
    this.authService.logout();
  }

  protected fullName(profile: UserProfile): string {
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  }

  protected initials(profile: UserProfile): string {
    const first = profile.firstName?.[0] ?? '';
    const last = profile.lastName?.[0] ?? '';

    return `${first}${last}`.toUpperCase();
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
    return expense.approved ? 'Подтвержден' : 'Ожидает подтверждения';
  }

  protected expenseAmount(expense: ExpenseListItem): string {
    const amount = Number(expense.price);

    if (!Number.isFinite(amount)) {
      return `${expense.price} ${expense.currency}`;
    }

    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: expense.currency,
      maximumFractionDigits: 0,
    }).format(amount);
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
        next: (profile) => {
          const canViewFinance = this.authService.access().canViewFinance;

          forkJoin({
            projects: this.projectsService.list({ page: 1, size: 4 }),
            events: this.eventsService.list({ page: 1, size: 4 }),
            companies: this.companiesService.list({ page: 1, size: 5 }),
            expenses: canViewFinance
              ? this.expensesService.list({ page: 1, size: 5 })
              : of(this.emptyPage<ExpenseListItem>()),
          })
            .pipe(take(1))
            .subscribe({
              next: (data) => {
                this.dashboard.set({
                  profile,
                  ...data,
                });
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

  private emptyPage<T>(): PaginatedResponse<T> {
    return {
      rows: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
    };
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000 и обновите страницу.';
    }

    return 'Не удалось загрузить данные обзора. Попробуйте обновить страницу.';
  }
}
