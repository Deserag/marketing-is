import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import { ProjectDetails, ProjectListItem, ProjectSprint } from './project.models';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(query: ListQuery): Observable<PaginatedResponse<ProjectListItem>> {
    return this.http.post<PaginatedResponse<ProjectListItem>>(
      `${this.apiBaseUrl}/projects/list`,
      query,
    );
  }

  details(id: string): Observable<ProjectDetails> {
    return this.http.get<ProjectDetails>(`${this.apiBaseUrl}/projects/${id}`);
  }

  sprints(id: string): Observable<ProjectSprint[]> {
    return this.http.get<ProjectSprint[]>(`${this.apiBaseUrl}/projects/${id}/sprints`);
  }
}
