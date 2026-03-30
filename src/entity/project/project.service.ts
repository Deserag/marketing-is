import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import { ListQuery, PaginatedResponse } from '../common/pagination.models';
import {
  AddProjectParticipantsPayload,
  CreateProjectExpensePayload,
  CreateProjectParticipantPayload,
  CreateProjectPayload,
  CreateProjectSprintPayload,
  ProjectDetails,
  ProjectExpense,
  ProjectListItem,
  ProjectParticipant,
  ProjectSprint,
  UpdateProjectExpensePayload,
  UpdateProjectParticipantPayload,
  UpdateProjectPayload,
  UpdateProjectSprintPayload,
} from './project.models';

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

  options(): Observable<ProjectListItem[]> {
    return this.http.get<ProjectListItem[]>(`${this.apiBaseUrl}/projects`);
  }

  create(payload: CreateProjectPayload): Observable<ProjectDetails> {
    return this.http.post<ProjectDetails>(`${this.apiBaseUrl}/projects`, payload);
  }

  details(id: string): Observable<ProjectDetails> {
    return this.http.get<ProjectDetails>(`${this.apiBaseUrl}/projects/${id}`);
  }

  update(id: string, payload: UpdateProjectPayload): Observable<ProjectDetails> {
    return this.http.patch<ProjectDetails>(`${this.apiBaseUrl}/projects/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/projects/${id}`);
  }

  sprints(id: string): Observable<ProjectSprint[]> {
    return this.http.get<ProjectSprint[]>(`${this.apiBaseUrl}/projects/${id}/sprints`);
  }

  participants(id: string): Observable<ProjectParticipant[]> {
    return this.http.get<ProjectParticipant[]>(`${this.apiBaseUrl}/projects/${id}/participants`);
  }

  createParticipant(
    id: string,
    payload: CreateProjectParticipantPayload,
  ): Observable<ProjectParticipant> {
    return this.http.post<ProjectParticipant>(
      `${this.apiBaseUrl}/projects/${id}/participants`,
      payload,
    );
  }

  addParticipants(
    id: string,
    payload: AddProjectParticipantsPayload,
  ): Observable<{ addedCount: number; rows: ProjectParticipant[] }> {
    return this.http.post<{ addedCount: number; rows: ProjectParticipant[] }>(
      `${this.apiBaseUrl}/projects/${id}/participants/batch`,
      payload,
    );
  }

  updateParticipant(
    id: string,
    participantId: string,
    payload: UpdateProjectParticipantPayload,
  ): Observable<ProjectParticipant> {
    return this.http.patch<ProjectParticipant>(
      `${this.apiBaseUrl}/projects/${id}/participants/${participantId}`,
      payload,
    );
  }

  removeParticipant(id: string, participantId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/projects/${id}/participants/${participantId}`,
    );
  }

  createSprint(id: string, payload: CreateProjectSprintPayload): Observable<ProjectSprint> {
    return this.http.post<ProjectSprint>(`${this.apiBaseUrl}/projects/${id}/sprints`, payload);
  }

  updateSprint(
    id: string,
    sprintId: string,
    payload: UpdateProjectSprintPayload,
  ): Observable<ProjectSprint> {
    return this.http.patch<ProjectSprint>(
      `${this.apiBaseUrl}/projects/${id}/sprints/${sprintId}`,
      payload,
    );
  }

  removeSprint(id: string, sprintId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/projects/${id}/sprints/${sprintId}`,
    );
  }

  expenses(id: string): Observable<ProjectExpense[]> {
    return this.http.get<ProjectExpense[]>(`${this.apiBaseUrl}/projects/${id}/expenses`);
  }

  createExpense(id: string, payload: CreateProjectExpensePayload): Observable<ProjectExpense> {
    return this.http.post<ProjectExpense>(`${this.apiBaseUrl}/projects/${id}/expenses`, payload);
  }

  updateExpense(
    id: string,
    expenseId: string,
    payload: UpdateProjectExpensePayload,
  ): Observable<ProjectExpense> {
    return this.http.patch<ProjectExpense>(
      `${this.apiBaseUrl}/projects/${id}/expenses/${expenseId}`,
      payload,
    );
  }

  removeExpense(id: string, expenseId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiBaseUrl}/projects/${id}/expenses/${expenseId}`,
    );
  }

  uploadResultFile(id: string, file: File, name?: string): Observable<ProjectDetails> {
    const formData = new FormData();
    formData.append('file', file);

    if (name?.trim()) {
      formData.append('name', name.trim());
    }

    return this.http.post<ProjectDetails>(`${this.apiBaseUrl}/projects/${id}/result-file`, formData);
  }

  removeResultFile(id: string): Observable<ProjectDetails> {
    return this.http.delete<ProjectDetails>(`${this.apiBaseUrl}/projects/${id}/result-file`);
  }

  uploadSprintTaskFile(
    id: string,
    sprintId: string,
    file: File,
    name?: string,
  ): Observable<ProjectSprint> {
    const formData = new FormData();
    formData.append('file', file);

    if (name?.trim()) {
      formData.append('name', name.trim());
    }

    return this.http.post<ProjectSprint>(
      `${this.apiBaseUrl}/projects/${id}/sprints/${sprintId}/task-file`,
      formData,
    );
  }

  removeSprintTaskFile(id: string, sprintId: string): Observable<ProjectSprint> {
    return this.http.delete<ProjectSprint>(
      `${this.apiBaseUrl}/projects/${id}/sprints/${sprintId}/task-file`,
    );
  }
}
