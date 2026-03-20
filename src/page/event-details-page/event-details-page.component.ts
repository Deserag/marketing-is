import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import { EventDetails, EventMetric, EventParticipant } from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

@Component({
  selector: 'app-event-details-page',
  imports: [DatePipe, MetricCardComponent],
  templateUrl: './event-details-page.component.html',
  styleUrl: './event-details-page.component.css',
})
export class EventDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);

  protected readonly access = this.authService.access;
  protected readonly event = signal<EventDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly participantCount = computed(() => this.event()?.participants.length ?? 0);
  protected readonly reminderCount = computed(() => this.event()?.reminders.length ?? 0);
  protected readonly metricCount = computed(() => this.event()?.metrics.length ?? 0);
  protected readonly expenseCount = computed(() => this.event()?.expenses.length ?? 0);

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
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
    const employee = participant.companyEmployee;
    return [employee.firstName, employee.lastName].filter(Boolean).join(' ');
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

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    return 'Не удалось загрузить карточку мероприятия.';
  }
}
