import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { take } from 'rxjs';
import { UserRole } from '../../entity/auth/auth.models';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import {
  CreateUserPayload,
  UpdateUserPayload,
  UserListItem,
} from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-user-management',
  imports: [DatePipe, ReactiveFormsModule, ModalWindowComponent, UiIconComponent],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly usersService = inject(UsersService);

  readonly canCreate = input(true);
  readonly canEdit = input(true);
  readonly canDelete = input(true);
  readonly allowedRoles = input<UserRole[]>([
    'SUPERADMIN',
    'ADMIN',
    'MARKETER',
    'MANAGER',
    'EMPLOYEE',
  ]);

  protected readonly roles: UserRole[] = [
    'SUPERADMIN',
    'ADMIN',
    'MARKETER',
    'MANAGER',
    'EMPLOYEE',
  ];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<UserListItem> | null>(null);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly expanded = signal(true);
  protected readonly dialogOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isEditing = computed(() => !!this.selectedUserId());
  protected readonly availableRoles = computed(() =>
    this.roles.filter((role) => this.allowedRoles().includes(role)),
  );
  protected readonly canShowActions = computed(() => this.canEdit() || this.canDelete());
  protected readonly headerDescription = computed(() =>
    this.canCreate() || this.canShowActions()
      ? 'Список сотрудников и учетные записи.'
      : 'Список сотрудников доступен для просмотра.',
  );
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование пользователя' : 'Новый пользователь',
  );

  protected readonly form = this.formBuilder.group({
    login: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    role: ['MARKETER' as UserRole, [Validators.required]],
    lastName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    middleName: [''],
  });

  constructor() {
    this.resetForCreate();
    this.loadUsers();
  }

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected applySearch(): void {
    this.loadUsers();
  }

  protected reload(): void {
    this.loadUsers();
  }

  protected openCreateDialog(): void {
    if (!this.canCreate()) {
      return;
    }

    this.resetForCreate();
    this.errorMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.errorMessage.set(null);
    this.resetForCreate();
  }

  protected editUser(user: UserListItem): void {
    if (!this.canEdit()) {
      return;
    }

    this.selectedUserId.set(user.id);
    this.form.reset({
      login: user.login,
      email: user.email,
      password: '',
      role: user.role,
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName ?? '',
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.syncPasswordValidators();
    this.dialogOpen.set(true);
  }

  protected submit(): void {
    const selectedUserId = this.selectedUserId();

    if ((selectedUserId && !this.canEdit()) || (!selectedUserId && !this.canCreate())) {
      return;
    }

    this.syncPasswordValidators();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (selectedUserId) {
      this.usersService
        .update(selectedUserId, this.buildUpdatePayload())
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.dialogOpen.set(false);
            this.successMessage.set('Изменения пользователя сохранены.');
            this.resetForCreate();
            this.loadUsers();
          },
          error: (error: unknown) => {
            this.submitting.set(false);
            this.errorMessage.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.usersService
      .create(this.buildCreatePayload())
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          this.successMessage.set('Пользователь создан.');
          this.resetForCreate();
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected deleteUser(user: UserListItem): void {
    if (!this.canDelete()) {
      return;
    }

    const confirmation = confirm(`Удалить пользователя ${user.firstName} ${user.lastName}?`);

    if (!confirmation) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usersService
      .remove(user.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Пользователь удален.');

          if (this.selectedUserId() === user.id) {
            this.closeDialog();
          }

          this.loadUsers();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      SUPERADMIN: 'Суперадмин',
      ADMIN: 'Администратор',
      MARKETER: 'Маркетолог',
      MANAGER: 'Менеджер',
      EMPLOYEE: 'Сотрудник',
    };

    return labels[role];
  }

  protected fieldInvalid(
    fieldName:
      | 'login'
      | 'email'
      | 'password'
      | 'role'
      | 'lastName'
      | 'firstName',
  ): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private resetForCreate(): void {
    this.selectedUserId.set(null);
    this.form.reset({
      login: '',
      email: '',
      password: '',
      role: this.defaultRole(),
      lastName: '',
      firstName: '',
      middleName: '',
    });
    this.syncPasswordValidators();
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.searchControl.value.trim();

    this.usersService
      .list({
        page: 1,
        size: 8,
        search: search || undefined,
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

  private buildCreatePayload(): CreateUserPayload {
    const raw = this.form.getRawValue();

    return {
      login: raw.login.trim(),
      email: raw.email.trim(),
      password: raw.password.trim(),
      role: raw.role,
      lastName: raw.lastName.trim(),
      firstName: raw.firstName.trim(),
      middleName: raw.middleName.trim() || undefined,
    };
  }

  private buildUpdatePayload(): UpdateUserPayload {
    const raw = this.form.getRawValue();
    const middleName = raw.middleName.trim();
    const password = raw.password.trim();

    return {
      login: raw.login.trim(),
      email: raw.email.trim(),
      role: raw.role,
      lastName: raw.lastName.trim(),
      firstName: raw.firstName.trim(),
      middleName: middleName || null,
      password: password || undefined,
    };
  }

  private syncPasswordValidators(): void {
    const passwordControl = this.form.controls.password;

    if (this.isEditing()) {
      passwordControl.setValidators([Validators.minLength(8)]);
    } else {
      passwordControl.setValidators([Validators.required, Validators.minLength(8)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }

  private defaultRole(): UserRole {
    return this.availableRoles()[0] ?? 'EMPLOYEE';
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

    return 'Не удалось выполнить операцию с пользователями.';
  }
}
