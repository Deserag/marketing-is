import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import {
  CompanyDetails,
  CompanyListItem,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from './company.models';

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: ListQuery): Observable<PaginatedResponse<CompanyListItem>> {
    return this.http.post<PaginatedResponse<CompanyListItem>>(
      `${this.apiBaseUrl}/companies/list`,
      query,
    );
  }

  create(payload: CreateCompanyPayload): Observable<CompanyDetails> {
    return this.http.post<CompanyDetails>(`${this.apiBaseUrl}/companies`, payload);
  }

  update(id: string, payload: UpdateCompanyPayload): Observable<CompanyDetails> {
    return this.http.patch<CompanyDetails>(
      `${this.apiBaseUrl}/companies/${id}`,
      payload,
    );
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/companies/${id}`,
    );
  }
}
