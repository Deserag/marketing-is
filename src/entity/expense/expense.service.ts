import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ExpenseListQuery, ExpenseListResponse } from './expense.models';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: ExpenseListQuery): Observable<ExpenseListResponse> {
    return this.http.post<ExpenseListResponse>(
      `${this.apiBaseUrl}/expenses/list`,
      query,
    );
  }
}
