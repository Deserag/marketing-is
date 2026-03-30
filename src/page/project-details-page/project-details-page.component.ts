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
import { API_BASE_URL } from '../../app/app.tokens';
import { AuthService } from '../../entity/auth/auth.service';
import {
  Currency,
  ExpenseType,
  ProjectDetails,
  ProjectExpense,
  ProjectParticipant,
  ProjectSprint,
} from '../../entity/project/project.models';
import { ProjectsService } from '../../entity/project/project.service';
import { UserListItem } from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

@Component({
  selector: 'app-project-details-page',
  imports: [DatePipe, ReactiveFormsModule, MetricCardComponent],
  templateUrl: './project-details-page.component.html',
  styleUrl: './project-details-page.component.css',
})
export class ProjectDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectsService = inject(ProjectsService);
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  protected readonly project = signal<ProjectDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly userOptions = signal<UserListItem[]>([]);
  protected readonly participantBusy = signal(false);
  protected readonly participantError = signal<string | null>(null);
  protected readonly participantSuccess = signal<string | null>(null);
  protected readonly sprintBusy = signal(false);
  protected readonly sprintError = signal<string | null>(null);
  protected readonly sprintSuccess = signal<string | null>(null);
  protected readonly expenseBusy = signal(false);
  protected readonly expenseError = signal<string | null>(null);
  protected readonly expenseSuccess = signal<string | null>(null);
  protected readonly resultFileBusy = signal(false);
  protected readonly resultFileError = signal<string | null>(null);
  protected readonly resultFileSuccess = signal<string | null>(null);
  protected readonly selectedParticipantId = signal<string | null>(null);
  protected readonly selectedSprintId = signal<string | null>(null);
  protected readonly selectedExpenseId = signal<string | null>(null);
  protected readonly currentUserId = computed(
    () => this.authService.profile()?.id ?? this.authService.session()?.sub ?? null,
  );

  protected readonly sprintCount = computed(() => this.project()?.sprints.length ?? 0);
  protected readonly participantCount = computed(() => this.project()?.participants.length ?? 0);
  protected readonly expenseCount = computed(() => this.project()?.expenses.length ?? 0);
  protected readonly hasResultFile = computed(() => !!this.project()?.resultFile);
  protected readonly canManageProject = computed(() => {
    if (this.authService.access().canManageProjects) {
      return true;
    }

    const currentUserId = this.currentUserId();
    const participant = this.project()?.participants.find((item) => item.userId === currentUserId);

    return ['OWNER', 'MANAGER', 'LEAD'].includes(participant?.role ?? '');
  });
  protected readonly availableUserOptions = computed(() => {
    const project = this.project();
    const editedParticipant = this.selectedParticipantId()
      ? project?.participants.find((participant) => participant.id === this.selectedParticipantId())
      : null;
    const takenUserIds = new Set(
      (project?.participants ?? [])
        .filter((participant) => participant.userId !== editedParticipant?.userId)
        .map((participant) => participant.userId),
    );

    return this.userOptions().filter((user) => !takenUserIds.has(user.id));
  });

  protected readonly participantForm = this.formBuilder.group({
    userIds: this.formBuilder.control<string[]>([]),
    role: ['MEMBER', [Validators.required]],
  });

  protected readonly sprintForm = this.formBuilder.group({
    taskText: ['', [Validators.required, Validators.maxLength(2000)]],
    startDate: ['', [Validators.required]],
    endDate: [''],
  });

  protected readonly expenseForm = this.formBuilder.group({
    name: ['', [Validators.required]],
    description: [''],
    type: ['OTHER' as ExpenseType, [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0)]],
    currency: ['RUB' as Currency, [Validators.required]],
    spentAt: ['', [Validators.required]],
  });

  constructor() {
    this.loadUserOptions();
    this.cancelParticipantEdit();
    this.cancelSprintEdit();
    this.cancelExpenseEdit();

    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
          this.clearSectionMessages();
          this.cancelParticipantEdit();
          this.cancelSprintEdit();
          this.cancelExpenseEdit();
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
      LEAD: 'Лид',
      MEMBER: 'Участник',
      EXECUTOR: 'Исполнитель',
    };

    return labels[role] ?? role;
  }

  protected expenseTypeLabel(type: ExpenseType): string {
    const labels: Record<ExpenseType, string> = {
      ADVERTISING: 'Реклама',
      RENT: 'Аренда',
      CONTENT: 'Контент',
      OTHER: 'Другое',
    };

    return labels[type];
  }

  protected fullName(user: ProjectParticipant['user'] | ProjectExpense['initiator']): string {
    return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');
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

  protected buildDownloadUrl(downloadUrl: string): string {
    return downloadUrl.startsWith('http') ? downloadUrl : `${this.apiBaseUrl}${downloadUrl}`;
  }

  protected formatAmount(amount: string, currency: Currency): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected editParticipant(participant: ProjectParticipant): void {
    this.selectedParticipantId.set(participant.id);
    this.participantForm.reset({
      userIds: [participant.userId],
      role: participant.role,
    });
    this.participantError.set(null);
    this.participantSuccess.set(null);
  }

  protected cancelParticipantEdit(): void {
    this.selectedParticipantId.set(null);
    this.participantForm.reset({
      userIds: [],
      role: 'MEMBER',
    });
  }

  protected submitParticipant(): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    const raw = this.participantForm.getRawValue();

    if (!raw.userIds.length || this.participantForm.controls.role.invalid) {
      this.participantForm.markAllAsTouched();
      this.participantError.set('Выберите хотя бы одного пользователя и роль.');
      return;
    }

    const selectedParticipantId = this.selectedParticipantId();
    this.participantBusy.set(true);
    this.participantError.set(null);
    this.participantSuccess.set(null);

    if (selectedParticipantId) {
      this.projectsService
        .updateParticipant(project.id, selectedParticipantId, {
          userId: raw.userIds[0],
          role: raw.role,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.participantBusy.set(false);
            this.participantSuccess.set('Участник обновлен.');
            this.cancelParticipantEdit();
            this.reloadProject();
          },
          error: (error: unknown) => {
            this.participantBusy.set(false);
            this.participantError.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.projectsService
      .addParticipants(project.id, {
        userIds: raw.userIds,
        role: raw.role,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.participantBusy.set(false);
          this.participantSuccess.set('Участники добавлены.');
          this.cancelParticipantEdit();
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.participantBusy.set(false);
          this.participantError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected removeParticipant(participantId: string): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    this.participantBusy.set(true);
    this.participantError.set(null);
    this.participantSuccess.set(null);

    this.projectsService
      .removeParticipant(project.id, participantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.participantBusy.set(false);
          this.participantSuccess.set('Участник удален.');
          this.cancelParticipantEdit();
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.participantBusy.set(false);
          this.participantError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected editSprint(sprint: ProjectSprint): void {
    this.selectedSprintId.set(sprint.id);
    this.sprintForm.reset({
      taskText: sprint.taskText,
      startDate: this.toDateTimeLocalValue(sprint.startDate),
      endDate: sprint.endDate ? this.toDateTimeLocalValue(sprint.endDate) : '',
    });
    this.sprintError.set(null);
    this.sprintSuccess.set(null);
  }

  protected cancelSprintEdit(): void {
    const startDate = this.roundToNearestHour(new Date());
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

    this.selectedSprintId.set(null);
    this.sprintForm.reset({
      taskText: '',
      startDate: this.toDateTimeLocalValue(startDate.toISOString()),
      endDate: this.toDateTimeLocalValue(endDate.toISOString()),
    });
  }

  protected submitSprint(): void {
    const project = this.project();

    if (!project || !this.canManageProject() || this.sprintForm.invalid) {
      this.sprintForm.markAllAsTouched();
      return;
    }

    const raw = this.sprintForm.getRawValue();
    const selectedSprintId = this.selectedSprintId();
    this.sprintBusy.set(true);
    this.sprintError.set(null);
    this.sprintSuccess.set(null);

    const request = selectedSprintId
      ? this.projectsService.updateSprint(project.id, selectedSprintId, {
          taskText: raw.taskText.trim(),
          startDate: new Date(raw.startDate).toISOString(),
          endDate: raw.endDate ? new Date(raw.endDate).toISOString() : null,
        })
      : this.projectsService.createSprint(project.id, {
          taskText: raw.taskText.trim(),
          startDate: new Date(raw.startDate).toISOString(),
          endDate: raw.endDate ? new Date(raw.endDate).toISOString() : undefined,
        });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sprintBusy.set(false);
        this.sprintSuccess.set(selectedSprintId ? 'Спринт обновлен.' : 'Спринт добавлен.');
        this.cancelSprintEdit();
        this.reloadProject();
      },
      error: (error: unknown) => {
        this.sprintBusy.set(false);
        this.sprintError.set(this.resolveErrorMessage(error));
      },
    });
  }

  protected removeSprint(sprintId: string): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    this.sprintBusy.set(true);
    this.sprintError.set(null);
    this.sprintSuccess.set(null);

    this.projectsService
      .removeSprint(project.id, sprintId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sprintBusy.set(false);
          this.sprintSuccess.set('Спринт удален.');
          this.cancelSprintEdit();
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.sprintBusy.set(false);
          this.sprintError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected editExpense(expense: ProjectExpense): void {
    this.selectedExpenseId.set(expense.id);
    this.expenseForm.reset({
      name: expense.name,
      description: expense.description ?? '',
      type: expense.type,
      amount: Number(expense.amount),
      currency: expense.currency,
      spentAt: this.toDateTimeLocalValue(expense.spentAt),
    });
    this.expenseError.set(null);
    this.expenseSuccess.set(null);
  }

  protected cancelExpenseEdit(): void {
    const spentAt = this.roundToNearestHour(new Date());

    this.selectedExpenseId.set(null);
    this.expenseForm.reset({
      name: '',
      description: '',
      type: 'OTHER',
      amount: 0,
      currency: 'RUB',
      spentAt: this.toDateTimeLocalValue(spentAt.toISOString()),
    });
  }

  protected submitExpense(): void {
    const project = this.project();

    if (!project || !this.canManageProject() || this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const raw = this.expenseForm.getRawValue();
    const selectedExpenseId = this.selectedExpenseId();
    this.expenseBusy.set(true);
    this.expenseError.set(null);
    this.expenseSuccess.set(null);

    const payload = {
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      type: raw.type,
      amount: Number(raw.amount),
      currency: raw.currency,
      spentAt: new Date(raw.spentAt).toISOString(),
    };

    if (selectedExpenseId) {
      this.projectsService
        .updateExpense(project.id, selectedExpenseId, {
          ...payload,
          description: raw.description.trim() || null,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.expenseBusy.set(false);
            this.expenseSuccess.set('Расход обновлен.');
            this.cancelExpenseEdit();
            this.reloadProject();
          },
          error: (error: unknown) => {
            this.expenseBusy.set(false);
            this.expenseError.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.projectsService
      .createExpense(project.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.expenseBusy.set(false);
          this.expenseSuccess.set('Расход добавлен.');
          this.cancelExpenseEdit();
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.expenseBusy.set(false);
          this.expenseError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected removeExpense(expenseId: string): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    this.expenseBusy.set(true);
    this.expenseError.set(null);
    this.expenseSuccess.set(null);

    this.projectsService
      .removeExpense(project.id, expenseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.expenseBusy.set(false);
          this.expenseSuccess.set('Расход удален.');
          this.cancelExpenseEdit();
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.expenseBusy.set(false);
          this.expenseError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected uploadResultFile(event: Event): void {
    const project = this.project();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!project || !file || !this.canManageProject()) {
      return;
    }

    this.resultFileBusy.set(true);
    this.resultFileError.set(null);
    this.resultFileSuccess.set(null);

    this.projectsService
      .uploadResultFile(project.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedProject) => {
          this.project.set(updatedProject);
          this.resultFileBusy.set(false);
          this.resultFileSuccess.set('Итоговый файл загружен.');
          input.value = '';
        },
        error: (error: unknown) => {
          this.resultFileBusy.set(false);
          this.resultFileError.set(this.resolveErrorMessage(error));
          input.value = '';
        },
      });
  }

  protected removeResultFile(): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    this.resultFileBusy.set(true);
    this.resultFileError.set(null);
    this.resultFileSuccess.set(null);

    this.projectsService
      .removeResultFile(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedProject) => {
          this.project.set(updatedProject);
          this.resultFileBusy.set(false);
          this.resultFileSuccess.set('Итоговый файл удален.');
        },
        error: (error: unknown) => {
          this.resultFileBusy.set(false);
          this.resultFileError.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected uploadSprintFile(sprint: ProjectSprint, event: Event): void {
    const project = this.project();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!project || !file || !this.canManageProject()) {
      return;
    }

    this.sprintBusy.set(true);
    this.sprintError.set(null);
    this.sprintSuccess.set(null);

    this.projectsService
      .uploadSprintTaskFile(project.id, sprint.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sprintBusy.set(false);
          this.sprintSuccess.set('Файл задачи загружен.');
          this.reloadProject();
          input.value = '';
        },
        error: (error: unknown) => {
          this.sprintBusy.set(false);
          this.sprintError.set(this.resolveErrorMessage(error));
          input.value = '';
        },
      });
  }

  protected removeSprintFile(sprintId: string): void {
    const project = this.project();

    if (!project || !this.canManageProject()) {
      return;
    }

    this.sprintBusy.set(true);
    this.sprintError.set(null);
    this.sprintSuccess.set(null);

    this.projectsService
      .removeSprintTaskFile(project.id, sprintId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sprintBusy.set(false);
          this.sprintSuccess.set('Файл задачи удален.');
          this.reloadProject();
        },
        error: (error: unknown) => {
          this.sprintBusy.set(false);
          this.sprintError.set(this.resolveErrorMessage(error));
        },
      });
  }

  private reloadProject(): void {
    const project = this.project();

    if (!project) {
      return;
    }

    this.projectsService
      .details(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.project.set(details);
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
    this.participantError.set(null);
    this.participantSuccess.set(null);
    this.sprintError.set(null);
    this.sprintSuccess.set(null);
    this.expenseError.set(null);
    this.expenseSuccess.set(null);
    this.resultFileError.set(null);
    this.resultFileSuccess.set(null);
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

    return 'Не удалось загрузить карточку проекта.';
  }
}
