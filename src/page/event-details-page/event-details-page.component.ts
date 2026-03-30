import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import {
  EventDetails,
  EventExpense,
  EventMetric,
  EventParticipant,
} from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { buildUserSearchTerms, formatUserFullName } from '../../entity/user/user.helpers';
import { UserListItem } from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';
import { ParticipantSelectorComponent } from '../../widget/participant-selector/participant-selector.component';
import { UiIconComponent } from '../../widget/ui-icon/ui-icon.component';

@Component({
  selector: 'app-event-details-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MetricCardComponent,
    ParticipantSelectorComponent,
    UiIconComponent,
  ],
  templateUrl: './event-details-page.component.html',
  styleUrl: './event-details-page.component.css',
})
export class EventDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly access = this.authService.access;
  protected readonly event = signal<EventDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly userOptions = signal<UserListItem[]>([]);
  protected readonly participantsBusy = signal(false);
  protected readonly participantsError = signal<string | null>(null);
  protected readonly participantsSuccess = signal<string | null>(null);
  protected readonly remindersBusy = signal(false);
  protected readonly remindersError = signal<string | null>(null);
  protected readonly remindersSuccess = signal<string | null>(null);
  protected readonly metricsBusy = signal(false);
  protected readonly metricsError = signal<string | null>(null);
  protected readonly metricsSuccess = signal<string | null>(null);
  protected readonly expensesBusy = signal(false);
  protected readonly expensesError = signal<string | null>(null);
  protected readonly expensesSuccess = signal<string | null>(null);
  protected readonly currentUserId = computed(
    () => this.authService.profile()?.id ?? this.authService.session()?.sub ?? null,
  );
  protected readonly participantCount = computed(() => this.event()?.participants.length ?? 0);
  protected readonly reminderCount = computed(() => this.event()?.reminders.length ?? 0);
  protected readonly metricCount = computed(() => this.event()?.metrics.length ?? 0);
  protected readonly expenseCount = computed(() => this.event()?.expenses.length ?? 0);
  protected readonly canManageEvent = computed(() => {
    const event = this.event();
    const currentUserId = this.currentUserId();

    return !!event && (this.access().canManageAllEvents || event.responsibleId === currentUserId);
  });
  protected readonly canExtendEvent = computed(() => {
    if (this.canManageEvent()) {
      return true;
    }

    return this.authService.currentRole() === 'MANAGER';
  });
  protected readonly availableParticipantOptions = computed(() => {
    const activeIds = new Set(
      (this.event()?.participants ?? []).map((participant) => participant.userId),
    );

    return this.userOptions().filter((user) => !activeIds.has(user.id));
  });
  protected readonly participantOptions = computed(() =>
    this.availableParticipantOptions().map((user) => ({
      id: user.id,
      label: formatUserFullName(user),
      searchTerms: buildUserSearchTerms(user),
    })),
  );

  protected readonly participantForm = this.formBuilder.group({
    userIds: this.formBuilder.control<string[]>([], [Validators.required]),
  });

  protected readonly reminderForm = this.formBuilder.group({
    remindBeforeHours: [24, [Validators.required, Validators.min(1)]],
  });

  protected readonly metricForm = this.formBuilder.group({
    leads: ['', [Validators.min(0)]],
    sales: ['', [Validators.min(0)]],
    revenue: ['', [Validators.min(0)]],
  });

  protected readonly expenseForm = this.formBuilder.group({
    name: ['', [Validators.required]],
    type: ['OTHER' as 'ADVERTISING' | 'RENT' | 'CONTENT' | 'OTHER', [Validators.required]],
    price: ['', [Validators.required, Validators.min(0)]],
    currency: ['RUB' as 'RUB' | 'USD' | 'EUR', [Validators.required]],
  });

  constructor() {
    this.loadUserOptions();

    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
          this.clearSectionMessages();
        }),
        switchMap((params) => this.eventsService.details(params.get('id') ?? '')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          this.event.set(event);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type] ?? type;
  }

  protected responsibleName(event: EventDetails): string {
    return [event.responsible.firstName, event.responsible.lastName].filter(Boolean).join(' ');
  }

  protected participantName(participant: EventParticipant): string {
    return formatUserFullName(participant.user);
  }

  protected userOptionLabel(user: UserListItem): string {
    return formatUserFullName(user);
  }

  protected dateLabel(startDate: string, endDate?: string | null): string {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    const start = formatter.format(new Date(startDate));

    if (!endDate) {
      return start;
    }

    return `${start} - ${formatter.format(new Date(endDate))}`;
  }

  protected metricSummary(metric: EventMetric): string {
    const parts = [
      metric.leads != null ? `Лиды: ${metric.leads}` : null,
      metric.sales != null ? `Продажи: ${metric.sales}` : null,
      this.access().canViewFinance && metric.revenue != null ? `Выручка: ${metric.revenue}` : null,
    ].filter(Boolean);

    return parts.join(' · ') || 'Метрика без значений';
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected updateParticipantsSelection(userIds: string[]): void {
    this.participantForm.controls.userIds.setValue(userIds);
    this.participantForm.controls.userIds.markAsDirty();
  }

  protected participantUsersInvalid(): boolean {
    const control = this.participantForm.controls.userIds;
    return control.invalid && (control.dirty || control.touched);
  }

  protected participantUsersError(): string | null {
    return this.participantUsersInvalid() ? 'Выберите хотя бы одного участника.' : null;
  }

  protected reminderFieldInvalid(): boolean {
    const control = this.reminderForm.controls.remindBeforeHours;
    return control.invalid && (control.dirty || control.touched);
  }

  protected reminderFieldError(): string | null {
    const control = this.reminderForm.controls.remindBeforeHours;

    if (!this.reminderFieldInvalid()) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Укажите количество часов.';
    }

    if (control.errors?.['min']) {
      return 'Напоминание можно поставить минимум за 1 час.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected metricFieldInvalid(fieldName: keyof typeof this.metricForm.controls): boolean {
    const control = this.metricForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected metricFieldError(fieldName: keyof typeof this.metricForm.controls): string | null {
    const control = this.metricForm.controls[fieldName];

    if (!this.metricFieldInvalid(fieldName)) {
      return null;
    }

    if (control.errors?.['min']) {
      return 'Значение не может быть отрицательным.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected expenseFieldInvalid(fieldName: keyof typeof this.expenseForm.controls): boolean {
    const control = this.expenseForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected expenseFieldError(fieldName: keyof typeof this.expenseForm.controls): string | null {
    const control = this.expenseForm.controls[fieldName];

    if (!this.expenseFieldInvalid(fieldName)) {
      return null;
    }

    if (control.errors?.['required']) {
      const messages: Partial<Record<keyof typeof this.expenseForm.controls, string>> = {
        name: 'Введите название расхода.',
        type: 'Выберите тип расхода.',
        price: 'Укажите сумму расхода.',
        currency: 'Выберите валюту.',
      };

      return messages[fieldName] ?? 'Поле обязательно для заполнения.';
    }

    if (control.errors?.['min']) {
      return 'Сумма расхода не может быть отрицательной.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected addParticipants(): void {
    const event = this.event();
    const userIds = this.participantForm.controls.userIds.value;

    if (!event || !this.canExtendEvent() || userIds.length === 0) {
      this.participantForm.markAllAsTouched();
      return;
    }

    this.participantsBusy.set(true);
    this.participantsError.set(null);
    this.participantsSuccess.set(null);

    this.eventsService
      .addParticipants(event.id, userIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.participantForm.controls.userIds.setValue([]);
          this.participantsBusy.set(false);
          this.participantsSuccess.set('Участники добавлены.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.participantsBusy.set(false);
          this.participantsError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected removeParticipant(participant: EventParticipant): void {
    const event = this.event();

    if (!event || !this.canManageEvent()) {
      return;
    }

    this.participantsBusy.set(true);
    this.participantsError.set(null);
    this.participantsSuccess.set(null);

    this.eventsService
      .removeParticipant(event.id, participant.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.participantsBusy.set(false);
          this.participantsSuccess.set('Участник удалён.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.participantsBusy.set(false);
          this.participantsError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected createReminder(): void {
    const event = this.event();

    if (!event || !this.canExtendEvent() || this.reminderForm.invalid) {
      this.reminderForm.markAllAsTouched();
      return;
    }

    this.remindersBusy.set(true);
    this.remindersError.set(null);
    this.remindersSuccess.set(null);

    this.eventsService
      .createReminder(event.id, {
        remindBeforeHours: Number(this.reminderForm.controls.remindBeforeHours.value),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reminderForm.reset({ remindBeforeHours: 24 });
          this.remindersBusy.set(false);
          this.remindersSuccess.set('Напоминание добавлено.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.remindersBusy.set(false);
          this.remindersError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected removeReminder(reminderId: string): void {
    const event = this.event();

    if (!event || !this.canManageEvent()) {
      return;
    }

    this.remindersBusy.set(true);
    this.remindersError.set(null);
    this.remindersSuccess.set(null);

    this.eventsService
      .removeReminder(event.id, reminderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.remindersBusy.set(false);
          this.remindersSuccess.set('Напоминание удалено.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.remindersBusy.set(false);
          this.remindersError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected createMetric(): void {
    const event = this.event();

    if (!event || !this.canExtendEvent()) {
      return;
    }

    if (this.metricForm.invalid) {
      this.metricForm.markAllAsTouched();
      return;
    }

    const raw = this.metricForm.getRawValue();
    const payload = {
      leads: raw.leads ? Number(raw.leads) : undefined,
      sales: raw.sales ? Number(raw.sales) : undefined,
      revenue: raw.revenue ? Number(raw.revenue) : undefined,
    };

    if (payload.leads == null && payload.sales == null && payload.revenue == null) {
      this.metricsError.set('Укажите хотя бы одно значение метрики.');
      return;
    }

    this.metricsBusy.set(true);
    this.metricsError.set(null);
    this.metricsSuccess.set(null);

    this.eventsService
      .createMetric(event.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.metricForm.reset({
            leads: '',
            sales: '',
            revenue: '',
          });
          this.metricsBusy.set(false);
          this.metricsSuccess.set('Метрика добавлена.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.metricsBusy.set(false);
          this.metricsError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected createExpense(): void {
    const event = this.event();

    if (!event || !this.canExtendEvent() || this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const raw = this.expenseForm.getRawValue();

    this.expensesBusy.set(true);
    this.expensesError.set(null);
    this.expensesSuccess.set(null);

    this.eventsService
      .createExpense(event.id, {
        name: raw.name.trim(),
        type: raw.type,
        price: Number(raw.price),
        currency: raw.currency,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.expenseForm.reset({
            name: '',
            type: 'OTHER',
            price: '',
            currency: 'RUB',
          });
          this.expensesBusy.set(false);
          this.expensesSuccess.set('Расход добавлен.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.expensesBusy.set(false);
          this.expensesError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected approveExpense(expense: EventExpense): void {
    const event = this.event();

    if (!event || !this.canManageEvent() || expense.approved) {
      return;
    }

    this.expensesBusy.set(true);
    this.expensesError.set(null);
    this.expensesSuccess.set(null);

    this.eventsService
      .approveExpense(event.id, expense.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.expensesBusy.set(false);
          this.expensesSuccess.set('Расход подтверждён.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.expensesBusy.set(false);
          this.expensesError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected removeExpense(expenseId: string): void {
    const event = this.event();

    if (!event || !this.canManageEvent()) {
      return;
    }

    this.expensesBusy.set(true);
    this.expensesError.set(null);
    this.expensesSuccess.set(null);

    this.eventsService
      .removeExpense(event.id, expenseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.expensesBusy.set(false);
          this.expensesSuccess.set('Расход удалён.');
          this.reloadEvent();
        },
        error: (error: unknown) => {
          this.expensesBusy.set(false);
          this.expensesError.set(this.resolveErrorMessage(error));
        },
      });
  }

  private reloadEvent(): void {
    const event = this.event();

    if (!event) {
      return;
    }

    this.eventsService
      .details(event.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.event.set(details);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private loadUserOptions(): void {
    this.usersService
      .options()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.userOptions.set(users);
        },
        error: () => {
          this.userOptions.set([]);
        },
      });
  }

  private clearSectionMessages(): void {
    this.participantsError.set(null);
    this.participantsSuccess.set(null);
    this.remindersError.set(null);
    this.remindersSuccess.set(null);
    this.metricsError.set(null);
    this.metricsSuccess.set(null);
    this.expensesError.set(null);
    this.expensesSuccess.set(null);
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.length) {
        return message.join(', ');
      }
    }

    return 'Не удалось загрузить карточку мероприятия.';
  }
}
