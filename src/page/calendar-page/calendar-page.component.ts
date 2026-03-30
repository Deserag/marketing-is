import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import {
  CreateEventPayload,
  EventDetails,
  EventListItem,
  EventType,
  UpdateEventPayload,
} from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { buildUserSearchTerms, formatUserFullName } from '../../entity/user/user.helpers';
import { UserListItem } from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { ModalWindowComponent } from '../../widget/modal-window/modal-window.component';
import { ParticipantSelectorComponent } from '../../widget/participant-selector/participant-selector.component';
import { UiIconComponent } from '../../widget/ui-icon/ui-icon.component';

type CalendarViewMode = 'all' | 'mine';

type CalendarDay = {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: EventListItem[];
  hiddenCount: number;
};

@Component({
  selector: 'app-calendar-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ModalWindowComponent,
    ParticipantSelectorComponent,
    UiIconComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
})
export class CalendarPageComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);

  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly viewMode = signal<CalendarViewMode>('all');
  protected readonly viewMonth = signal(this.startOfMonth(new Date()));
  protected readonly selectedDateKey = signal<string | null>(null);
  protected readonly events = signal<EventListItem[]>([]);
  protected readonly responsibles = signal<UserListItem[]>([]);
  protected readonly dialogOpen = signal(false);
  protected readonly dialogLoading = signal(false);
  protected readonly dialogSubmitting = signal(false);
  protected readonly dialogErrorMessage = signal<string | null>(null);
  protected readonly dateRangeInvalid = signal(false);
  protected readonly selectedEventId = signal<string | null>(null);
  protected readonly weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  protected readonly currentUserId = computed(
    () => this.auth.profile()?.id ?? this.auth.session()?.sub ?? null,
  );
  protected readonly pageTitle = computed(() =>
    this.viewMode() === 'mine' ? 'Мой календарь' : 'Календарь событий',
  );
  protected readonly isEditing = computed(() => !!this.selectedEventId());
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование события' : 'Создание события',
  );
  protected readonly participantOptions = computed(() =>
    this.responsibles().map((user) => ({
      id: user.id,
      label: formatUserFullName(user),
      searchTerms: buildUserSearchTerms(user),
    })),
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required]],
    type: ['WEBINAR' as EventType, [Validators.required]],
    startDate: ['', [Validators.required]],
    endDate: [''],
    description: [''],
    responsibleId: ['', [Validators.required]],
    participants: this.formBuilder.control<string[]>([]),
  });

  private hasLoadedCalendar = false;

  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
    }).format(this.viewMonth()),
  );

  protected readonly selectedDate = computed(() =>
    this.selectedDateKey() ? this.dateFromKey(this.selectedDateKey()!) : null,
  );

  protected readonly todayEventsCount = computed(() =>
    this.eventsForDate(this.events(), new Date()).length,
  );

  protected readonly days = computed<CalendarDay[]>(() => {
    const month = this.viewMonth();
    const gridStart = this.startOfWeek(this.startOfMonth(month));
    const todayKey = this.toDateKey(new Date());
    const selectedKey = this.selectedDateKey();
    const events = this.events();

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      const dayEvents = this.eventsForDate(events, date).sort(
        (left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
      );

      return {
        key: this.toDateKey(date),
        date,
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isToday: this.toDateKey(date) === todayKey,
        isSelected: this.toDateKey(date) === selectedKey,
        events: dayEvents.slice(0, 2),
        hiddenCount: Math.max(dayEvents.length - 2, 0),
      };
    });
  });

  protected readonly selectedDayEvents = computed(() => {
    const selectedDate = this.selectedDate();

    if (!selectedDate) {
      return [];
    }

    return this.eventsForDate(this.events(), selectedDate).sort(
      (left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
    );
  });

  constructor() {
    this.loadResponsibleOptions();
    this.resetForm();

    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.viewMode.set(data['mode'] === 'mine' ? 'mine' : 'all');
      this.selectedDateKey.set(null);
      this.loadCalendar();
    });
  }

  protected reload(): void {
    this.loadCalendar();
  }

  protected closeSelectedDate(): void {
    this.selectedDateKey.set(null);
  }

  protected previousMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    this.shiftMonth(1);
  }

  protected goToToday(): void {
    this.viewMonth.set(this.startOfMonth(new Date()));
    this.selectedDateKey.set(null);
    this.loadCalendar();
  }

  protected selectDay(day: CalendarDay): void {
    this.selectedDateKey.set(day.key);

    if (!day.inCurrentMonth) {
      this.viewMonth.set(this.startOfMonth(day.date));
      this.loadCalendar();
    }
  }

  protected openCreateDialog(date?: Date): void {
    if (!this.auth.access().canCreateEvents) {
      return;
    }

    this.selectedEventId.set(null);
    this.resetForm(date);
    this.dialogLoading.set(false);
    this.dateRangeInvalid.set(false);
    this.dialogErrorMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected openEditDialog(event: EventListItem): void {
    if (!this.canEditEvent(event)) {
      return;
    }

    this.selectedEventId.set(event.id);
    this.dateRangeInvalid.set(false);
    this.dialogErrorMessage.set(null);
    this.dialogLoading.set(true);
    this.dialogOpen.set(true);

    this.eventsService
      .details(event.id)
      .pipe(take(1))
      .subscribe({
        next: (details) => {
          this.fillForm(details);
          this.dialogLoading.set(false);
        },
        error: (error: unknown) => {
          this.dialogLoading.set(false);
          this.dialogErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected openEventDetails(eventId: string): void {
    void this.router.navigate(['/events', eventId]);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.dialogLoading.set(false);
    this.dateRangeInvalid.set(false);
    this.dialogErrorMessage.set(null);
    this.selectedEventId.set(null);
    this.resetForm();
  }

  protected submitDialog(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const startDate = this.form.controls.startDate.value;
    const endDate = this.form.controls.endDate.value;

    this.dateRangeInvalid.set(false);

    if (endDate && new Date(endDate).getTime() < new Date(startDate).getTime()) {
      this.dateRangeInvalid.set(true);
      this.dialogErrorMessage.set('Дата окончания не может быть раньше даты начала.');
      return;
    }

    this.dialogSubmitting.set(true);
    this.dialogErrorMessage.set(null);
    this.successMessage.set(null);

    const selectedEventId = this.selectedEventId();

    if (selectedEventId) {
      this.eventsService
        .update(selectedEventId, this.buildUpdatePayload())
        .pipe(take(1))
        .subscribe({
          next: (event) => {
            this.dialogSubmitting.set(false);
            this.dialogOpen.set(false);
            this.successMessage.set('Событие обновлено.');
            this.selectedDateKey.set(this.toDateKey(new Date(event.startDate)));
            this.selectedEventId.set(null);
            this.resetForm();
            this.loadCalendar();
          },
          error: (error: unknown) => {
            this.dialogSubmitting.set(false);
            this.dialogErrorMessage.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.eventsService
      .create(this.buildCreatePayload())
      .pipe(take(1))
      .subscribe({
        next: (event) => {
          this.dialogSubmitting.set(false);
          this.dialogOpen.set(false);
          this.successMessage.set('Событие создано.');
          this.selectedDateKey.set(this.toDateKey(new Date(event.startDate)));
          this.resetForm();
          this.loadCalendar();
        },
        error: (error: unknown) => {
          this.dialogSubmitting.set(false);
          this.dialogErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected canEditEvent(event: EventListItem): boolean {
    return this.auth.access().canManageAllEvents || event.responsibleId === this.currentUserId();
  }

  protected eventTypeLabel(type: EventType): string {
    const labels: Record<EventType, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type];
  }

  protected eventTimeLabel(event: EventListItem): string {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const start = formatter.format(new Date(event.startDate));

    if (!event.endDate) {
      return start;
    }

    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    if (this.isSameDay(startDate, endDate)) {
      return `${start} - ${formatter.format(endDate)}`;
    }

    return `${start} и далее`;
  }

  protected selectedDateLabel(): string {
    const selectedDate = this.selectedDate();

    if (!selectedDate) {
      return '';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(selectedDate);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected updateParticipants(userIds: string[]): void {
    this.form.controls.participants.setValue(userIds);
    this.form.controls.participants.markAsDirty();
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
        name: 'Введите название события.',
        type: 'Выберите тип события.',
        startDate: 'Укажите дату и время начала.',
        responsibleId: 'Выберите ответственного.',
      };

      return messages[fieldName] ?? 'Поле обязательно для заполнения.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected endDateError(): string | null {
    return this.dateRangeInvalid() ? 'Дата окончания не может быть раньше даты начала.' : null;
  }

  private loadCalendar(): void {
    if (this.hasLoadedCalendar) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }

    this.errorMessage.set(null);

    const intervalStart = this.startOfWeek(this.startOfMonth(this.viewMonth()));
    const intervalEnd = this.endOfWeek(this.endOfMonth(this.viewMonth()));

    this.eventsService
      .list({
        page: 1,
        size: 1000,
        startDate: intervalStart.toISOString(),
        endDate: intervalEnd.toISOString(),
        mine: this.viewMode() === 'mine' ? true : undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.events.set(response.rows);
          this.loading.set(false);
          this.refreshing.set(false);
          this.hasLoadedCalendar = true;
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.refreshing.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private loadResponsibleOptions(): void {
    this.usersService
      .options()
      .pipe(take(1))
      .subscribe({
        next: (users) => {
          this.responsibles.set(users);
          this.ensureResponsibleSelection();
        },
        error: () => {
          const profile = this.auth.profile();
          this.responsibles.set(profile ? [{ ...profile }] : []);
          this.ensureResponsibleSelection();
        },
      });
  }

  private ensureResponsibleSelection(): void {
    const currentValue = this.form.controls.responsibleId.value.trim();

    if (currentValue) {
      return;
    }

    this.form.controls.responsibleId.setValue(
      this.currentUserId() ?? this.responsibles()[0]?.id ?? '',
    );
  }

  private fillForm(details: EventDetails): void {
    this.form.reset({
      name: details.name,
      type: details.type,
      startDate: this.toDateTimeLocalValue(details.startDate),
      endDate: details.endDate ? this.toDateTimeLocalValue(details.endDate) : '',
      description: details.description ?? '',
      responsibleId: details.responsibleId,
      participants: details.participants.map((participant) => participant.userId),
    });
  }

  private buildCreatePayload(): CreateEventPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      type: raw.type,
      startDate: new Date(raw.startDate).toISOString(),
      endDate: raw.endDate ? new Date(raw.endDate).toISOString() : undefined,
      description: raw.description.trim() || undefined,
      responsibleId: raw.responsibleId.trim(),
      participants: raw.participants,
    };
  }

  private buildUpdatePayload(): UpdateEventPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      type: raw.type,
      startDate: new Date(raw.startDate).toISOString(),
      endDate: raw.endDate ? new Date(raw.endDate).toISOString() : null,
      description: raw.description.trim() || null,
      responsibleId: raw.responsibleId.trim(),
      participants: raw.participants,
    };
  }

  private resetForm(date?: Date): void {
    const startDate = date ?? this.roundToNearestHour(new Date());
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    this.form.reset({
      name: '',
      type: 'WEBINAR',
      startDate: this.toDateTimeLocalValue(startDate.toISOString()),
      endDate: this.toDateTimeLocalValue(endDate.toISOString()),
      description: '',
      responsibleId: this.currentUserId() ?? this.responsibles()[0]?.id ?? '',
      participants: [],
    });
  }

  private shiftMonth(offset: number): void {
    const month = this.viewMonth();
    this.viewMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    this.selectedDateKey.set(null);
    this.loadCalendar();
  }

  private eventsForDate(events: EventListItem[], date: Date): EventListItem[] {
    const target = this.startOfDay(date).getTime();

    return events.filter((event) => {
      const start = this.startOfDay(new Date(event.startDate)).getTime();
      const end = this.startOfDay(new Date(event.endDate ?? event.startDate)).getTime();

      return start <= target && end >= target;
    });
  }

  private roundToNearestHour(date: Date): Date {
    const value = new Date(date);
    value.setMinutes(0, 0, 0);
    value.setHours(value.getHours() + 1);
    return value;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    return this.startOfDay(result);
  }

  private endOfWeek(date: Date): Date {
    const result = this.startOfWeek(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private dateFromKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
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

    return 'Не удалось загрузить календарь событий.';
  }
}
