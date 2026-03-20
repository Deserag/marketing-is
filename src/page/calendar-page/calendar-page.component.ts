import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap, take } from 'rxjs';
import { EventListItem } from '../../entity/event/event.models';
import { EventsService } from '../../entity/event/event.service';
import { ProjectListItem, ProjectSprint } from '../../entity/project/project.models';
import { ProjectsService } from '../../entity/project/project.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';
import { UiIconComponent } from '../../widget/ui-icon/ui-icon.component';

type CalendarEntryKind = 'project' | 'task' | 'event';

type CalendarEntry = {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  subtitle: string;
  meta: string;
  startDate: Date;
  endDate: Date;
  route: string[];
};

type CalendarDay = {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  totalCount: number;
  counts: Record<CalendarEntryKind, number>;
};

type ProjectSchedule = {
  project: ProjectListItem;
  sprints: ProjectSprint[];
};

@Component({
  selector: 'app-calendar-page',
  imports: [DatePipe, RouterLink, MetricCardComponent, UiIconComponent],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
})
export class CalendarPageComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly eventsService = inject(EventsService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly viewMonth = signal(this.startOfMonth(new Date()));
  protected readonly selectedDateKey = signal(this.toDateKey(new Date()));
  protected readonly projectSchedules = signal<ProjectSchedule[]>([]);
  protected readonly events = signal<EventListItem[]>([]);
  protected readonly weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
    }).format(this.viewMonth()),
  );

  protected readonly selectedDate = computed(() => this.dateFromKey(this.selectedDateKey()));

  protected readonly entries = computed<CalendarEntry[]>(() => {
    const projectEntries = this.projectSchedules().map(({ project, sprints }) => {
      const schedule = this.resolveProjectWindow(project, sprints);

      return {
        id: `project-${project.id}`,
        kind: 'project' as const,
        title: project.name,
        subtitle: sprints.length
          ? 'Период проекта собран по задачам и спринтам.'
          : 'У проекта пока нет задач, поэтому он отмечен датой создания.',
        meta: sprints.length ? `${sprints.length} задач в проекте` : 'Проект без задач',
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        route: ['/projects', project.id],
      };
    });

    const taskEntries = this.projectSchedules().flatMap(({ project, sprints }) =>
      sprints.map((sprint) => ({
        id: `task-${sprint.id}`,
        kind: 'task' as const,
        title: sprint.taskText,
        subtitle: project.name,
        meta: sprint.taskFile?.name ? `Файл: ${sprint.taskFile.name}` : 'Задача проекта',
        startDate: this.asDate(sprint.startDate),
        endDate: this.asDate(sprint.endDate ?? sprint.startDate),
        route: ['/projects', project.id],
      })),
    );

    const eventEntries = this.events().map((event) => ({
      id: `event-${event.id}`,
      kind: 'event' as const,
      title: event.name,
      subtitle: this.eventTypeLabel(event.type),
      meta: [event.responsible.firstName, event.responsible.lastName].filter(Boolean).join(' '),
      startDate: this.asDate(event.startDate),
      endDate: this.asDate(event.endDate ?? event.startDate),
      route: ['/events', event.id],
    }));

    return [...projectEntries, ...taskEntries, ...eventEntries].sort(
      (left, right) => left.startDate.getTime() - right.startDate.getTime(),
    );
  });

  protected readonly days = computed<CalendarDay[]>(() => {
    const month = this.viewMonth();
    const gridStart = this.startOfWeek(this.startOfMonth(month));
    const entries = this.entries();
    const selectedKey = this.selectedDateKey();
    const todayKey = this.toDateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      const key = this.toDateKey(date);
      const dayEntries = this.entriesForDate(entries, date);

      return {
        key,
        date,
        inCurrentMonth: date.getMonth() === month.getMonth(),
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        totalCount: dayEntries.length,
        counts: {
          project: dayEntries.filter((entry) => entry.kind === 'project').length,
          task: dayEntries.filter((entry) => entry.kind === 'task').length,
          event: dayEntries.filter((entry) => entry.kind === 'event').length,
        },
      };
    });
  });

  protected readonly selectedDayEntries = computed(() =>
    this.entriesForDate(this.entries(), this.selectedDate()).sort(
      (left, right) => left.startDate.getTime() - right.startDate.getTime(),
    ),
  );

  protected readonly projectCount = computed(() => this.projectSchedules().length);
  protected readonly taskCountInMonth = computed(
    () =>
      this.entries().filter(
        (entry) => entry.kind === 'task' && this.isInCurrentMonth(entry.startDate, this.viewMonth()),
      ).length,
  );
  protected readonly eventCountInMonth = computed(
    () =>
      this.entries().filter(
        (entry) => entry.kind === 'event' && this.isInCurrentMonth(entry.startDate, this.viewMonth()),
      ).length,
  );
  protected readonly busyDaysCount = computed(
    () => this.days().filter((day) => day.inCurrentMonth && day.totalCount > 0).length,
  );

  constructor() {
    this.loadCalendar();
  }

  protected previousMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    this.shiftMonth(1);
  }

  protected goToToday(): void {
    const today = new Date();
    this.viewMonth.set(this.startOfMonth(today));
    this.selectedDateKey.set(this.toDateKey(today));
  }

  protected selectDay(day: CalendarDay): void {
    this.selectedDateKey.set(day.key);

    if (!day.inCurrentMonth) {
      this.viewMonth.set(this.startOfMonth(day.date));
    }
  }

  protected entryTypeLabel(kind: CalendarEntryKind): string {
    const labels: Record<CalendarEntryKind, string> = {
      project: 'Проект',
      task: 'Задача',
      event: 'Мероприятие',
    };

    return labels[kind];
  }

  protected entryDateLabel(entry: CalendarEntry): string {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    });

    const start = formatter.format(entry.startDate);
    const end = formatter.format(entry.endDate);

    return start === end ? start : `${start} - ${end}`;
  }

  protected reload(): void {
    this.loadCalendar();
  }

  private loadCalendar(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectsService
      .list({ page: 1, size: 100 })
      .pipe(
        take(1),
        switchMap((projectsPage) => {
          const projectRequests = projectsPage.rows.map((project) =>
            this.projectsService.sprints(project.id).pipe(map((sprints) => ({ project, sprints }))),
          );

          return forkJoin({
            projectSchedules: projectRequests.length
              ? forkJoin(projectRequests)
              : of<ProjectSchedule[]>([]),
            eventsPage: this.eventsService.list({ page: 1, size: 100 }),
          });
        }),
      )
      .subscribe({
        next: ({ projectSchedules, eventsPage }) => {
          this.projectSchedules.set(projectSchedules);
          this.events.set(eventsPage.rows);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private shiftMonth(offset: number): void {
    const month = this.viewMonth();
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);

    this.viewMonth.set(nextMonth);
    this.selectedDateKey.set(this.toDateKey(nextMonth));
  }

  private resolveProjectWindow(project: ProjectListItem, sprints: ProjectSprint[]): {
    startDate: Date;
    endDate: Date;
  } {
    if (!sprints.length) {
      const createdAt = this.asDate(project.createdAt);

      return {
        startDate: createdAt,
        endDate: createdAt,
      };
    }

    const startDate = sprints.reduce(
      (current, sprint) => {
        const date = this.asDate(sprint.startDate);
        return date.getTime() < current.getTime() ? date : current;
      },
      this.asDate(sprints[0].startDate),
    );

    const endDate = sprints.reduce(
      (current, sprint) => {
        const date = this.asDate(sprint.endDate ?? sprint.startDate);
        return date.getTime() > current.getTime() ? date : current;
      },
      this.asDate(sprints[0].endDate ?? sprints[0].startDate),
    );

    return { startDate, endDate };
  }

  private entriesForDate(entries: CalendarEntry[], date: Date): CalendarEntry[] {
    const target = this.startOfDay(date).getTime();

    return entries.filter((entry) => {
      const start = this.startOfDay(entry.startDate).getTime();
      const end = this.startOfDay(entry.endDate).getTime();

      return start <= target && end >= target;
    });
  }

  private eventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      WEBINAR: 'Вебинар',
      MEETING: 'Встреча',
      CAMPAIGN: 'Кампания',
    };

    return labels[type] ?? type;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    return 'Не удалось загрузить календарь задач и мероприятий.';
  }

  private isInCurrentMonth(date: Date, month: Date): boolean {
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + offset);

    return this.startOfDay(result);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private asDate(value: string): Date {
    return new Date(value);
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
}
