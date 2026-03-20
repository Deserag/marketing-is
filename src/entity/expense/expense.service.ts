import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import { ExpenseListItem } from './expense.models';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: ListQuery): Observable<PaginatedResponse<ExpenseListItem>> {
    return this.http.post<PaginatedResponse<ExpenseListItem>>(
      `${this.apiBaseUrl}/expenses/list`,
      query,
    );
  }
}
