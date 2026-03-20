import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { ProjectDetails } from '../../entity/project/project.models';
import { ProjectsService } from '../../entity/project/project.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

@Component({
  selector: 'app-project-details-page',
  imports: [DatePipe, MetricCardComponent],
  templateUrl: './project-details-page.component.html',
  styleUrl: './project-details-page.component.css',
})
export class ProjectDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectsService = inject(ProjectsService);

  protected readonly project = signal<ProjectDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly sprintCount = computed(() => this.project()?.sprints.length ?? 0);
  protected readonly participantCount = computed(() => this.project()?.participants.length ?? 0);
  protected readonly hasResultFile = computed(() => !!this.project()?.resultFile);

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((params) => this.projectsService.details(params.get('id') ?? '')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.project.set(project);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected participantRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      OWNER: 'Владелец',
      MANAGER: 'Менеджер',
      EXECUTOR: 'Исполнитель',
    };

    return labels[role] ?? role;
  }

  protected fullName(user: ProjectDetails['participants'][number]['user']): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  protected sprintDateLabel(startDate: string, endDate?: string | null): string {
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

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    return 'Не удалось загрузить карточку проекта.';
  }
}
