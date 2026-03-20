import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import { EventListItem } from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

type EventFilter = 'ALL' | 'WEBINAR' | 'MEETING' | 'CAMPAIGN';

@Component({
  selector: 'app-events-page',
  imports: [ReactiveFormsModule, RouterLink, MetricCardComponent],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.css',
})
export class EventsPageComponent {
  private readonly eventsService = inject(EventsService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly typeControl = new FormControl<EventFilter>('ALL', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<EventListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly withParticipantsCount = computed(
    () => this.pageData()?.rows.filter((event) => event.participantsCount > 0).length ?? 0,
  );
  protected readonly currentMonthCount = computed(() => {
    const rows = this.pageData()?.rows ?? [];
    const now = new Date();
    return rows.filter((event) => {
      const startDate = new Date(event.startDate);
      return (
        startDate.getMonth() === now.getMonth() &&
        startDate.getFullYear() === now.getFullYear()
      );
    }).length;
  });

  constructor() {
    this.loadEvents();
  }

  protected applyFilters(): void {
    this.loadEvents();
  }

  protected reload(): void {
    this.loadEvents();
  }

  protected eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type] ?? type;
  }

  protected fullName(event: EventListItem): string {
    return [event.responsible.firstName, event.responsible.lastName].filter(Boolean).join(' ');
  }

  protected dateLabel(startDate: string, endDate?: string | null): string {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
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

  private loadEvents(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const selectedType = this.typeControl.value;

    this.eventsService
      .list({
        page: 1,
        size: 24,
        search: this.searchControl.value.trim() || undefined,
        ...(selectedType !== 'ALL' ? { type: selectedType } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    return 'Не удалось загрузить список мероприятий.';
  }
}
