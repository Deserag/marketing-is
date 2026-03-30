import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { switchMap, take } from 'rxjs';
import { AuthService } from '../../entity/auth/auth.service';
import { UpdateUserPayload } from '../../entity/user/user.models';
import { UsersService } from '../../entity/user/user.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-shell',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ModalWindowComponent,
    UiIconComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);

  protected readonly navigationCollapsed = signal(false);
  protected readonly profileDialogOpen = signal(false);
  protected readonly profileSubmitting = signal(false);
  protected readonly profileErrorMessage = signal<string | null>(null);
  protected readonly profileSuccessMessage = signal<string | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly currentUserName = computed(() => {
    const profile = this.auth.profile();

    if (!profile) {
      return 'Пользователь';
    }

    return [profile.lastName, profile.firstName, profile.middleName]
      .filter(Boolean)
      .join(' ');
  });

  protected readonly profileForm = this.formBuilder.group({
    login: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    lastName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    middleName: [''],
    password: ['', [Validators.minLength(8)]],
  });

  constructor() {
    if (this.auth.isAuthenticated() && !this.auth.profile()) {
      this.auth
        .ensureCurrentProfile()
        .pipe(take(1))
        .subscribe({
          next: () => this.syncProfileForm(),
          error: () => undefined,
        });
    } else {
      this.syncProfileForm();
    }
  }

  protected toggleNavigation(): void {
    this.navigationCollapsed.update((value) => !value);
  }

  protected openProfileDialog(): void {
    this.syncProfileForm();
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.fieldErrors.set({});
    this.profileDialogOpen.set(true);
  }

  protected closeProfileDialog(): void {
    this.profileDialogOpen.set(false);
    this.profileErrorMessage.set(null);
    this.fieldErrors.set({});
    this.syncProfileForm();
  }

  protected submitProfile(): void {
    const profile = this.auth.profile();

    if (!profile) {
      return;
    }

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSubmitting.set(true);
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.fieldErrors.set({});

    this.usersService
      .update(profile.id, this.buildProfilePayload())
      .pipe(
        switchMap(() => this.auth.refreshCurrentUser()),
        take(1),
      )
      .subscribe({
        next: () => {
          this.profileSubmitting.set(false);
          this.profileSuccessMessage.set('Профиль обновлён.');
          this.profileDialogOpen.set(false);
          this.syncProfileForm();
        },
        error: (error: unknown) => {
          this.profileSubmitting.set(false);
          this.handleProfileError(error);
        },
      });
  }

  protected logout(): void {
    this.auth.logout();
  }

  protected fieldInvalid(fieldName: keyof typeof this.profileForm.controls): boolean {
    const control = this.profileForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected fieldError(fieldName: keyof typeof this.profileForm.controls): string | null {
    const fieldErrors = this.fieldErrors();

    if (fieldErrors[fieldName]) {
      return fieldErrors[fieldName];
    }

    const control = this.profileForm.controls[fieldName];

    if (!control.invalid || !(control.dirty || control.touched)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Поле обязательно для заполнения.';
    }

    if (control.errors?.['email']) {
      return 'Введите корректный email.';
    }

    if (control.errors?.['minlength']) {
      if (fieldName === 'password') {
        return 'Пароль должен содержать минимум 8 символов.';
      }

      return 'Минимальная длина поля: 3 символа.';
    }

    return null;
  }

  private syncProfileForm(): void {
    const profile = this.auth.profile();

    this.profileForm.reset({
      login: profile?.login ?? '',
      email: profile?.email ?? '',
      lastName: profile?.lastName ?? '',
      firstName: profile?.firstName ?? '',
      middleName: profile?.middleName ?? '',
      password: '',
    });
  }

  private buildProfilePayload(): UpdateUserPayload {
    const raw = this.profileForm.getRawValue();

    return {
      login: raw.login.trim(),
      email: raw.email.trim(),
      lastName: raw.lastName.trim(),
      firstName: raw.firstName.trim(),
      middleName: raw.middleName.trim() || null,
      password: raw.password.trim() || undefined,
    };
  }

  private handleProfileError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;
      const joinedMessage = Array.isArray(message) ? message.join(', ') : message;

      if (typeof joinedMessage === 'string') {
        const nextFieldErrors: Record<string, string> = {};

        if (joinedMessage.toLowerCase().includes('login')) {
          nextFieldErrors['login'] = joinedMessage;
        }

        if (joinedMessage.toLowerCase().includes('email')) {
          nextFieldErrors['email'] = joinedMessage;
        }

        this.fieldErrors.set(nextFieldErrors);
        this.profileErrorMessage.set(joinedMessage);
        return;
      }

      if (error.status === 0) {
        this.profileErrorMessage.set(
          'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.',
        );
        return;
      }
    }

    this.profileErrorMessage.set('Не удалось обновить профиль.');
  }
}
