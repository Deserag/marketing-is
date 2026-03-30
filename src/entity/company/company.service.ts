import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import {
  CompanyEmployee,
  CompanyEmployeeOption,
  CompanyDetails,
  CompanyListItem,
  CreateCompanyEmployeePayload,
  CreateCompanyPayload,
  UpdateCompanyEmployeePayload,
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

  details(id: string): Observable<CompanyDetails> {
    return this.http.get<CompanyDetails>(`${this.apiBaseUrl}/companies/${id}`);
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

  employeesOptions(): Observable<CompanyEmployeeOption[]> {
    return this.http.get<CompanyEmployeeOption[]>(
      `${this.apiBaseUrl}/companies/employees/options/active`,
    );
  }

  employees(companyId: string): Observable<CompanyEmployee[]> {
    return this.http.get<CompanyEmployee[]>(
      `${this.apiBaseUrl}/companies/${companyId}/employees`,
    );
  }

  createEmployee(
    companyId: string,
    payload: CreateCompanyEmployeePayload,
  ): Observable<CompanyEmployee> {
    return this.http.post<CompanyEmployee>(
      `${this.apiBaseUrl}/companies/${companyId}/employees`,
      payload,
    );
  }

  updateEmployee(
    companyId: string,
    employeeId: string,
    payload: UpdateCompanyEmployeePayload,
  ): Observable<CompanyEmployee> {
    return this.http.patch<CompanyEmployee>(
      `${this.apiBaseUrl}/companies/${companyId}/employees/${employeeId}`,
      payload,
    );
  }

  removeEmployee(
    companyId: string,
    employeeId: string,
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/companies/${companyId}/employees/${employeeId}`,
    );
  }
}
