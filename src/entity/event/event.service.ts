import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { PaginatedResponse } from '../common/pagination.models';
import {
  CreateEventExpensePayload,
  CreateEventMetricPayload,
  CreateEventReminderPayload,
  CreateEventPayload,
  EventDetails,
  EventExpense,
  EventListItem,
  EventListQuery,
  EventMetric,
  EventParticipant,
  EventReminder,
  UpdateEventPayload,
} from './event.models';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: EventListQuery): Observable<PaginatedResponse<EventListItem>> {
    return this.http.post<PaginatedResponse<EventListItem>>(
      `${this.apiBaseUrl}/events/list`,
      query,
    );
  }

  create(payload: CreateEventPayload): Observable<EventDetails> {
    return this.http.post<EventDetails>(`${this.apiBaseUrl}/events`, payload);
  }

  details(id: string): Observable<EventDetails> {
    return this.http.get<EventDetails>(`${this.apiBaseUrl}/events/${id}`);
  }

  update(id: string, payload: UpdateEventPayload): Observable<EventDetails> {
    return this.http.patch<EventDetails>(`${this.apiBaseUrl}/events/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/events/${id}`);
  }

  participants(id: string): Observable<EventParticipant[]> {
    return this.http.get<EventParticipant[]>(`${this.apiBaseUrl}/events/${id}/participants`);
  }

  addParticipants(
    id: string,
    userIds: string[],
  ): Observable<{ addedCount: number; skippedCount: number; rows: EventParticipant[] }> {
    return this.http.post<{ addedCount: number; skippedCount: number; rows: EventParticipant[] }>(
      `${this.apiBaseUrl}/events/${id}/participants`,
      { userIds },
    );
  }

  removeParticipant(id: string, participantId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/events/${id}/participants/${participantId}`,
    );
  }

  expenses(id: string): Observable<EventExpense[]> {
    return this.http.get<EventExpense[]>(`${this.apiBaseUrl}/events/${id}/expenses`);
  }

  createExpense(id: string, payload: CreateEventExpensePayload): Observable<EventExpense> {
    return this.http.post<EventExpense>(`${this.apiBaseUrl}/events/${id}/expenses`, payload);
  }

  approveExpense(id: string, expenseId: string): Observable<EventExpense> {
    return this.http.patch<EventExpense>(
      `${this.apiBaseUrl}/events/${id}/expenses/${expenseId}/approve`,
      {},
    );
  }

  removeExpense(id: string, expenseId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/events/${id}/expenses/${expenseId}`,
    );
  }

  metrics(id: string): Observable<EventMetric[]> {
    return this.http.get<EventMetric[]>(`${this.apiBaseUrl}/events/${id}/metrics`);
  }

  createMetric(id: string, payload: CreateEventMetricPayload): Observable<EventMetric> {
    return this.http.post<EventMetric>(`${this.apiBaseUrl}/events/${id}/metrics`, payload);
  }

  reminders(id: string): Observable<EventReminder[]> {
    return this.http.get<EventReminder[]>(`${this.apiBaseUrl}/events/${id}/reminders`);
  }

  createReminder(id: string, payload: CreateEventReminderPayload): Observable<EventReminder> {
    return this.http.post<EventReminder>(`${this.apiBaseUrl}/events/${id}/reminders`, payload);
  }

  removeReminder(id: string, reminderId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/events/${id}/reminders/${reminderId}`,
    );
  }
}
