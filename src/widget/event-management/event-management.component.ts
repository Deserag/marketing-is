import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import {
  CreateEventPayload,
  EventDetails,
  EventListItem,
  EventType,
  UpdateEventPayload,
  type EventListQuery,
} from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { UserListItem } from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

type EventFilter = 'ALL' | EventType;

@Component({
  selector: 'app-event-management',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ModalWindowComponent,
    PaginationControlsComponent,
    UiIconComponent,
  ],
  templateUrl: './event-management.component.html',
  styleUrl: './event-management.component.css',
})
export class EventManagementComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);

  readonly canCreate = input(true);
  readonly canManageAll = input(true);
  readonly canDelete = input(true);

  protected readonly pageSizeOptions = [8, 15, 25, 50];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly typeControl = new FormControl<EventFilter>('ALL', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<EventListItem> | null>(null);
  protected readonly responsibles = signal<UserListItem[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(15);
  protected readonly selectedEventId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly dialogLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isEditing = computed(() => !!this.selectedEventId());
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование мероприятия' : 'Новое мероприятие',
  );
  protected readonly currentUserId = computed(
    () => this.auth.profile()?.id ?? this.auth.session()?.sub ?? null,
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

  constructor() {
    this.loadResponsibleOptions();
    this.resetForCreate();
    this.loadEvents();
  }

  protected applyFilters(): void {
    this.currentPage.set(1);
    this.loadEvents();
  }

  protected reload(): void {
    this.loadEvents();
  }

  protected changePage(page: number): void {
    this.currentPage.set(page);
    this.loadEvents();
  }

  protected changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadEvents();
  }

  protected openCreateDialog(date?: Date): void {
    if (!this.canCreate()) {
      return;
    }

    this.resetForCreate(date);
    this.dialogLoading.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.dialogLoading.set(false);
    this.errorMessage.set(null);
    this.resetForCreate();
  }

  protected editEvent(event: EventListItem): void {
    if (!this.canEditEvent(event)) {
      return;
    }

    this.selectedEventId.set(event.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);
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
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected openEventDetails(eventId: string): void {
    void this.router.navigate(['/events', eventId]);
  }

  protected submit(): void {
    const selectedEventId = this.selectedEventId();

    if ((selectedEventId && !this.canManageCurrentForm()) || (!selectedEventId && !this.canCreate())) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const startDate = this.form.controls.startDate.value;
    const endDate = this.form.controls.endDate.value;

    if (endDate && new Date(endDate).getTime() < new Date(startDate).getTime()) {
      this.errorMessage.set('Дата окончания не может быть раньше даты начала.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (selectedEventId) {
      this.eventsService
        .update(selectedEventId, this.buildUpdatePayload())
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.dialogOpen.set(false);
            this.successMessage.set('Мероприятие обновлено.');
            this.resetForCreate();
            this.loadEvents();
          },
          error: (error: unknown) => {
            this.submitting.set(false);
            this.errorMessage.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.eventsService
      .create(this.buildCreatePayload())
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          this.successMessage.set('Мероприятие создано.');
          this.currentPage.set(1);
          this.resetForCreate();
          this.loadEvents();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected deleteEvent(event: EventListItem): void {
    if (!this.canDeleteEvent(event)) {
      return;
    }

    const confirmation = confirm(`Удалить мероприятие ${event.name}?`);

    if (!confirmation) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const nextPage =
      (this.pageData()?.rows.length ?? 0) === 1 && this.currentPage() > 1
        ? this.currentPage() - 1
        : this.currentPage();

    this.eventsService
      .remove(event.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Мероприятие удалено.');

          if (this.selectedEventId() === event.id) {
            this.closeDialog();
          }

          this.currentPage.set(nextPage);
          this.loadEvents();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected canEditEvent(event: EventListItem): boolean {
    return this.canManageAll() || event.responsibleId === this.currentUserId();
  }

  protected canDeleteEvent(event: EventListItem): boolean {
    return this.canDelete() && (this.canManageAll() || event.responsibleId === this.currentUserId());
  }

  protected eventTypeLabel(type: EventType): string {
    const labels: Record<EventType, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type];
  }

  protected responsibleName(event: EventListItem): string {
    return [event.responsible.firstName, event.responsible.lastName].filter(Boolean).join(' ');
  }

  protected dateLabel(startDate: string, endDate?: string | null): string {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const start = formatter.format(new Date(startDate));

    if (!endDate) {
      return start;
    }

    return `${start} - ${formatter.format(new Date(endDate))}`;
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected hasResponsibleOptions(): boolean {
    return this.responsibles().length > 0;
  }

  private canManageCurrentForm(): boolean {
    if (this.canManageAll()) {
      return true;
    }

    const responsibleId = this.form.controls.responsibleId.value.trim();
    const currentUserId = this.currentUserId();

    return !responsibleId || responsibleId === currentUserId;
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

  private resetForCreate(date?: Date): void {
    const baseStartDate = date ?? this.roundToNearestHour(new Date());
    const baseEndDate = new Date(baseStartDate.getTime() + 60 * 60 * 1000);

    this.selectedEventId.set(null);
    this.form.reset({
      name: '',
      type: 'WEBINAR',
      startDate: this.toDateTimeLocalValue(baseStartDate.toISOString()),
      endDate: this.toDateTimeLocalValue(baseEndDate.toISOString()),
      description: '',
      responsibleId: this.currentUserId() ?? '',
      participants: [],
    });
  }

  private loadEvents(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const query: EventListQuery = {
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.searchControl.value.trim() || undefined,
    };

    if (this.typeControl.value !== 'ALL') {
      query.type = this.typeControl.value;
    }

    this.eventsService
      .list(query)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.currentPage.set(response.currentPage);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
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

  private roundToNearestHour(date: Date): Date {
    const value = new Date(date);
    value.setMinutes(0, 0, 0);
    value.setHours(value.getHours() + 1);
    return value;
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

    return 'Не удалось выполнить операцию с мероприятиями.';
  }
}
