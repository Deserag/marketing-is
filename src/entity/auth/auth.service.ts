import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, switchMap, tap, throwError } from 'rxjs';
import {
  API_BASE_URL,
  AUTH_TOKEN_STORAGE_KEY,
} from '../../app/app.tokens';
import { AccessPolicy, buildAccessPolicy } from '../../app/access.rules';
import {
  AuthTokenPayload,
  AuthTokenResponse,
  LoginCredentials,
  UserProfile,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly initialToken = this.readStoredToken();
  private readonly tokenState = signal<string | null>(this.initialToken);
  private readonly sessionState = signal<AuthTokenPayload | null>(
    this.decodeTokenPayload(this.initialToken),
  );
  private readonly profileState = signal<UserProfile | null>(null);
  private readonly initializedState = signal(false);

  private restoreStarted = false;

  readonly token = computed(() => this.tokenState());
  readonly session = computed(() => this.sessionState());
  readonly profile = computed(() => this.profileState());
  readonly initialized = computed(() => this.initializedState());
  readonly isAuthenticated = computed(() => !!this.tokenState());
  readonly currentRole = computed(
    () => this.profileState()?.role ?? this.sessionState()?.role ?? null,
  );
  readonly access = computed<AccessPolicy>(() => buildAccessPolicy(this.currentRole()));
  readonly hasAdminAccess = computed(() => this.access().canAccessAdminPanel);

  restoreSession(): void {
    if (this.restoreStarted) {
      return;
    }

    this.restoreStarted = true;

    if (!this.tokenState()) {
      this.initializedState.set(true);
      return;
    }

    this.refreshCurrentUser().subscribe({
      next: () => this.initializedState.set(true),
      error: () => {
        this.clearSession(false);
        this.initializedState.set(true);
      },
    });
  }

  login(credentials: LoginCredentials): Observable<UserProfile> {
    return this.http
      .post<AuthTokenResponse>(this.buildUrl('/auth/login'), credentials)
      .pipe(
        tap(({ token }) => this.persistToken(token)),
        switchMap(() => this.refreshCurrentUser()),
        tap(() => this.initializedState.set(true)),
        catchError((error) => {
          this.clearSession(false);
          this.initializedState.set(true);
          return throwError(() => error);
        }),
      );
  }

  ensureCurrentProfile(): Observable<UserProfile> {
    const profile = this.profileState();

    if (profile) {
      return of(profile);
    }

    if (!this.tokenState()) {
      return throwError(() => new Error('Токен авторизации не найден.'));
    }

    return this.refreshCurrentUser();
  }

  refreshCurrentUser(): Observable<UserProfile> {
    if (!this.tokenState()) {
      return throwError(() => new Error('Токен авторизации не найден.'));
    }

    return this.http.get<AuthTokenPayload>(this.buildUrl('/auth/me')).pipe(
      switchMap((session) =>
        this.http.get<UserProfile>(this.buildUrl(`/users/${session.sub}`)).pipe(
          tap((profile) => {
            this.sessionState.set(session);
            this.profileState.set(profile);
          }),
        ),
      ),
    );
  }

  logout(): void {
    this.clearSession(true);
  }

  clearSession(redirect = false): void {
    this.tokenState.set(null);
    this.sessionState.set(null);
    this.profileState.set(null);
    this.removeStoredToken();

    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  private persistToken(token: string): void {
    this.tokenState.set(token);
    this.sessionState.set(this.decodeTokenPayload(token));
    this.profileState.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
  }

  private readStoredToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  private removeStoredToken(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  private buildUrl(path: string): string {
    return `${this.apiBaseUrl}${path}`;
  }

  private decodeTokenPayload(token: string | null): AuthTokenPayload | null {
    if (!token) {
      return null;
    }

    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    try {
      const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        '=',
      );

      return JSON.parse(atob(paddedPayload)) as AuthTokenPayload;
    } catch {
      return null;
    }
  }
}
