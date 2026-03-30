import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Observable, take } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import { EventListItem } from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import {
  ExpenseListItem,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseSourceType,
} from '../../entity/expense/expense.models';
import { ExpensesService } from '../../entity/expense/expense.service';
import { ProjectsService } from '../../entity/project/project.service';
import {
  Currency,
  ExpenseType,
  ProjectListItem,
} from '../../entity/project/project.models';
import { formatUserFullName } from '../../entity/user/user.helpers';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';
import { PaginationControlsComponent } from '../../widget/pagination-controls/pagination-controls.component';
import { UiIconComponent } from '../../widget/ui-icon/ui-icon.component';

type ExpenseFilterSource = 'ALL' | ExpenseSourceType;

@Component({
  selector: 'app-expenses-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MetricCardComponent,
    PaginationControlsComponent,
    UiIconComponent,
  ],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.css',
})
export class ExpensesPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly expensesService = inject(ExpensesService);
  private readonly projectsService = inject(ProjectsService);
  private readonly eventsService = inject(EventsService);

  protected readonly pageSizeOptions = [10, 20, 50];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly filterSourceType = new FormControl<ExpenseFilterSource>('ALL', {
    nonNullable: true,
  });
  protected readonly loading = signal(true);
  protected readonly supportLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly pageData = signal<ExpenseListResponse | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(15);
  protected readonly projectOptions = signal<ProjectListItem[]>([]);
  protected readonly eventOptions = signal<EventListItem[]>([]);
  protected readonly selectedSourceType = signal<ExpenseSourceType>('PROJECT');
  protected readonly currentUserName = computed(() =>
    this.authService.profile() ? formatUserFullName(this.authService.profile()!) : 'Текущий пользователь',
  );
  protected readonly sourceOptions = computed(() =>
    this.selectedSourceType() === 'PROJECT' ? this.projectOptions() : this.eventOptions(),
  );
  protected readonly sourceSupportsDetailedFields = computed(
    () => this.selectedSourceType() === 'PROJECT',
  );
  protected readonly summaryCards = computed(() => {
    const pageData = this.pageData();

    if (!pageData) {
      return [];
    }

    return [
      {
        label: 'Всего расходов',
        value: pageData.totalCount,
        hint: 'Все расходы по проектам и мероприятиям в текущем фильтре.',
        tone: 'slate' as const,
      },
      {
        label: 'Проектные расходы',
        value: pageData.summary.totalBySource.projects,
        hint: 'Расходы, привязанные к проектам.',
        tone: 'teal' as const,
      },
      {
        label: 'Расходы мероприятий',
        value: pageData.summary.totalBySource.events,
        hint: 'Заявки, созданные внутри мероприятий.',
        tone: 'amber' as const,
      },
      {
        label: 'Ожидают согласования',
        value: pageData.summary.pendingApproval,
        hint: 'Только расходы мероприятий, которые еще не подтверждены.',
        tone: 'rose' as const,
      },
    ];
  });

  protected readonly form = this.formBuilder.group({
    sourceType: ['PROJECT' as ExpenseSourceType, [Validators.required]],
    sourceId: ['', [Validators.required]],
    name: ['', [Validators.required]],
    description: [''],
    type: ['OTHER', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0)]],
    currency: ['RUB', [Validators.required]],
    spentAt: [this.toDateTimeLocalValue(new Date().toISOString()), [Validators.required]],
  });

  constructor() {
    this.form.controls.sourceType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sourceType) => {
        this.selectedSourceType.set(sourceType);
        this.form.controls.sourceId.setValue('');
        this.form.controls.sourceId.markAsPristine();
      });

    this.loadInitialData();
  }

  protected reload(): void {
    this.supportLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      projects: this.projectsService.options(),
      events: this.eventsService.list({ page: 1, size: 200 }),
      expenses: this.expensesService.list(this.buildQuery()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ projects, events, expenses }) => {
          this.projectOptions.set(projects);
          this.eventOptions.set(events.rows);
          this.pageData.set(expenses);
          this.supportLoading.set(false);
        },
        error: (error: unknown) => {
          this.supportLoading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected applyFilters(): void {
    this.currentPage.set(1);
    this.loadExpenses();
  }

  protected changePage(page: number): void {
    this.currentPage.set(page);
    this.loadExpenses();
  }

  protected changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadExpenses();
  }

  protected submitExpense(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const request$: Observable<unknown> =
      raw.sourceType === 'PROJECT'
        ? this.projectsService.createExpense(raw.sourceId, {
            name: raw.name.trim(),
            description: raw.description.trim() || undefined,
            type: raw.type as ExpenseType,
            amount: Number(raw.amount),
            currency: raw.currency as Currency,
            spentAt: new Date(raw.spentAt).toISOString(),
          })
        : this.eventsService.createExpense(raw.sourceId, {
            name: raw.name.trim(),
            type: raw.type as 'ADVERTISING' | 'RENT' | 'CONTENT' | 'OTHER',
            price: Number(raw.amount),
            currency: raw.currency as 'RUB' | 'USD' | 'EUR',
          });

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set(
          raw.sourceType === 'PROJECT'
            ? 'Расход проекта добавлен.'
            : 'Расход мероприятия добавлен.',
        );
        this.resetCreateForm(raw.sourceType);
        this.currentPage.set(1);
        this.loadExpenses();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  protected fieldInvalid(fieldName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected fieldError(fieldName: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[fieldName];

    if (!this.fieldInvalid(fieldName)) {
      return null;
    }

    if (control.errors?.['required']) {
      const messages: Partial<Record<keyof typeof this.form.controls, string>> = {
        sourceType: 'Выберите, куда будет привязан расход.',
        sourceId: 'Выберите проект или мероприятие.',
        name: 'Введите название расхода.',
        type: 'Выберите категорию расхода.',
        amount: 'Укажите сумму расхода.',
        currency: 'Выберите валюту.',
        spentAt: 'Укажите дату расхода.',
      };

      return messages[fieldName] ?? 'Поле обязательно для заполнения.';
    }

    if (control.errors?.['min']) {
      return 'Сумма расхода не может быть отрицательной.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected sourceTypeLabel(value: ExpenseSourceType): string {
    return value === 'PROJECT' ? 'Проект' : 'Мероприятие';
  }

  protected sourceOptionLabel(source: ProjectListItem | EventListItem): string {
    if ('type' in source) {
      return `${source.name} · ${this.eventTypeLabel(source.type)}`;
    }

    return source.name;
  }

  protected eventTypeLabel(type: string | null | undefined): string {
    const labels: Record<string, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return type ? labels[type] ?? type : 'Без типа';
  }

  protected initiatorName(expense: ExpenseListItem): string {
    return formatUserFullName(expense.initiator);
  }

  protected expenseSourceBadge(expense: ExpenseListItem): string {
    if (expense.sourceType === 'PROJECT') {
      return 'Проект';
    }

    return this.eventTypeLabel(expense.source.type);
  }

  protected approvalLabel(expense: ExpenseListItem): string {
    if (expense.approved === null) {
      return 'Без согласования';
    }

    return expense.approved ? 'Подтвержден' : 'Ожидает подтверждения';
  }

  protected formatAmount(expense: ExpenseListItem): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: expense.currency,
      maximumFractionDigits: 2,
    }).format(Number(expense.amount));
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      projects: this.projectsService.options(),
      events: this.eventsService.list({ page: 1, size: 200 }),
      expenses: this.expensesService.list(this.buildQuery()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ projects, events, expenses }) => {
          this.projectOptions.set(projects);
          this.eventOptions.set(events.rows);
          this.pageData.set(expenses);
          this.loading.set(false);
          this.resetCreateForm();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private loadExpenses(): void {
    this.supportLoading.set(true);
    this.errorMessage.set(null);

    this.expensesService
      .list(this.buildQuery())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.currentPage.set(response.currentPage);
          this.supportLoading.set(false);
        },
        error: (error: unknown) => {
          this.supportLoading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resetCreateForm(sourceType: ExpenseSourceType = this.form.controls.sourceType.value): void {
    this.form.reset({
      sourceType,
      sourceId: '',
      name: '',
      description: '',
      type: 'OTHER',
      amount: 0,
      currency: 'RUB',
      spentAt: this.toDateTimeLocalValue(new Date().toISOString()),
    });
  }

  private buildQuery(): ExpenseListQuery {
    return {
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.searchControl.value.trim() || undefined,
      sourceType: this.filterSourceType.value === 'ALL' ? undefined : this.filterSourceType.value,
    };
  }

  private toDateTimeLocalValue(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.length) {
        return message.join(', ');
      }

      if (error.status === 0) {
        return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
      }
    }

    return 'Не удалось загрузить раздел расходов.';
  }
}
