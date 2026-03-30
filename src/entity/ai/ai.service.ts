import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../app/app.tokens';
import {
  AiCard,
  AiChatDetail,
  AiChatSummary,
  AiOverview,
  CreateAiChatPayload,
  SendAiMessagePayload,
} from './ai.models';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  overview(): Observable<AiOverview> {
    return this.http.get<AiOverview>(`${this.apiBaseUrl}/ai/overview`);
  }

  cards(): Observable<AiCard[]> {
    return this.http.get<AiCard[]>(`${this.apiBaseUrl}/ai/cards`);
  }

  chats(): Observable<AiChatSummary[]> {
    return this.http.get<AiChatSummary[]>(`${this.apiBaseUrl}/ai/chats`);
  }

  createChat(payload: CreateAiChatPayload = {}): Observable<AiChatDetail> {
    return this.http.post<AiChatDetail>(`${this.apiBaseUrl}/ai/chats`, payload);
  }

  chat(chatId: string): Observable<AiChatDetail> {
    return this.http.get<AiChatDetail>(`${this.apiBaseUrl}/ai/chats/${chatId}`);
  }

  sendMessage(chatId: string, payload: SendAiMessagePayload): Observable<AiChatDetail> {
    return this.http.post<AiChatDetail>(
      `${this.apiBaseUrl}/ai/chats/${chatId}/messages`,
      payload,
    );
  }
}
