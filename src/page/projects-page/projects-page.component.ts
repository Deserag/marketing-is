import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import { ProjectListItem } from '../../entity/project/project.models';
import { ProjectsService } from '../../entity/project/project.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

@Component({
  selector: 'app-projects-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MetricCardComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.css',
})
export class ProjectsPageComponent {
  private readonly projectsService = inject(ProjectsService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<ProjectListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly withTasksCount = computed(
    () => this.pageData()?.rows.filter((project) => project._count.sprints > 0).length ?? 0,
  );
  protected readonly withResultFileCount = computed(
    () => this.pageData()?.rows.filter((project) => !!project.resultFile).length ?? 0,
  );

  constructor() {
    this.loadProjects();
  }

  protected applySearch(): void {
    this.loadProjects();
  }

  protected reload(): void {
    this.loadProjects();
  }

  protected description(project: ProjectListItem): string {
    return (
      project.description ||
      project.goal ||
      project.result ||
      'Описание проекта пока не заполнено.'
    );
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectsService
      .list({
        page: 1,
        size: 24,
        search: this.searchControl.value.trim() || undefined,
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

    return 'Не удалось загрузить список проектов.';
  }
}
