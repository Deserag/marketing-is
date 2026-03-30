import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import { CreateUserPayload, UpdateUserPayload, UserListItem } from './user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: ListQuery): Observable<PaginatedResponse<UserListItem>> {
    return this.http.post<PaginatedResponse<UserListItem>>(
      `${this.apiBaseUrl}/users/list`,
      query,
    );
  }

  options(): Observable<UserListItem[]> {
    return this.http.get<UserListItem[]>(`${this.apiBaseUrl}/users/options/active`);
  }

  create(payload: CreateUserPayload): Observable<UserListItem> {
    return this.http.post<UserListItem>(`${this.apiBaseUrl}/users`, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<UserListItem> {
    return this.http.patch<UserListItem>(`${this.apiBaseUrl}/users/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/users/${id}`);
  }
}
