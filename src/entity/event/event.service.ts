import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { PaginatedResponse } from '../common/pagination.models';
import { EventDetails, EventListItem, EventListQuery } from './event.models';

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

  details(id: string): Observable<EventDetails> {
    return this.http.get<EventDetails>(`${this.apiBaseUrl}/events/${id}`);
  }
}
