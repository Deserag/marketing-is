import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import {
  CreateProjectPayload,
  ProjectListItem,
  UpdateProjectPayload,
} from '../../entity/project/project.models';
import { ProjectsService } from '../../entity/project/project.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-project-management',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ModalWindowComponent,
    PaginationControlsComponent,
    UiIconComponent,
  ],
  templateUrl: './project-management.component.html',
  styleUrl: './project-management.component.css',
})
export class ProjectManagementComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly projectsService = inject(ProjectsService);

  readonly canCreate = input(true);
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  protected readonly pageSizeOptions = [8, 15, 25, 50];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<ProjectListItem> | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(15);
  protected readonly selectedProjectId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isEditing = computed(() => !!this.selectedProjectId());
  protected readonly canShowActions = computed(() => this.canEdit() || this.canDelete());
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование проекта' : 'Новый проект',
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required]],
    description: [''],
    goal: [''],
    result: [''],
  });

  constructor() {
    this.resetForCreate();
    this.loadProjects();
  }

  protected applySearch(): void {
    this.currentPage.set(1);
    this.loadProjects();
  }

  protected reload(): void {
    this.loadProjects();
  }

  protected changePage(page: number): void {
    this.currentPage.set(page);
    this.loadProjects();
  }

  protected changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadProjects();
  }

  protected openCreateDialog(): void {
    if (!this.canCreate()) {
      return;
    }

    this.resetForCreate();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.errorMessage.set(null);
    this.resetForCreate();
  }

  protected editProject(project: ProjectListItem): void {
    if (!this.canEdit()) {
      return;
    }

    this.selectedProjectId.set(project.id);
    this.form.reset({
      name: project.name,
      description: project.description ?? '',
      goal: project.goal ?? '',
      result: project.result ?? '',
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected submit(): void {
    const selectedProjectId = this.selectedProjectId();

    if ((selectedProjectId && !this.canEdit()) || (!selectedProjectId && !this.canCreate())) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (selectedProjectId) {
      this.projectsService
        .update(selectedProjectId, this.buildUpdatePayload())
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.dialogOpen.set(false);
            this.successMessage.set('Изменения проекта сохранены.');
            this.resetForCreate();
            this.loadProjects();
          },
          error: (error: unknown) => {
            this.submitting.set(false);
            this.errorMessage.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.projectsService
      .create(this.buildCreatePayload())
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          this.successMessage.set('Проект создан.');
          this.currentPage.set(1);
          this.resetForCreate();
          this.loadProjects();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected deleteProject(project: ProjectListItem): void {
    if (!this.canDelete()) {
      return;
    }

    const confirmation = confirm(`Удалить проект ${project.name}?`);

    if (!confirmation) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const nextPage =
      (this.pageData()?.rows.length ?? 0) === 1 && this.currentPage() > 1
        ? this.currentPage() - 1
        : this.currentPage();

    this.projectsService
      .remove(project.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Проект удален.');

          if (this.selectedProjectId() === project.id) {
            this.closeDialog();
          }

          this.currentPage.set(nextPage);
          this.loadProjects();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected description(project: ProjectListItem): string {
    return (
      project.description ||
      project.goal ||
      project.result ||
      'Описание проекта пока не заполнено.'
    );
  }

  protected fieldInvalid(fieldName: 'name'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private resetForCreate(): void {
    this.selectedProjectId.set(null);
    this.form.reset({
      name: '',
      description: '',
      goal: '',
      result: '',
    });
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.projectsService
      .list({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchControl.value.trim() || undefined,
      })
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

  private buildCreatePayload(): CreateProjectPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      goal: raw.goal.trim() || undefined,
      result: raw.result.trim() || undefined,
    };
  }

  private buildUpdatePayload(): UpdateProjectPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
      goal: raw.goal.trim() || null,
      result: raw.result.trim() || null,
    };
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

    return 'Не удалось выполнить операцию с проектами.';
  }
}
