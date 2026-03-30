import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { AiService } from '../../entity/ai/ai.service';
import {
  AiCard,
  AiChatSummary,
  AiOverview,
} from '../../entity/ai/ai.models';

type ExpenseBar = {
  label: string;
  total: number;
  count: number;
  width: number;
};

@Component({
  selector: 'app-analytics-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.css',
})
export class AnalyticsPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly aiService = inject(AiService);

  protected readonly loading = signal(true);
  protected readonly supportLoading = signal(false);
  protected readonly chatLoading = signal(false);
  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly chatErrorMessage = signal<string | null>(null);
  protected readonly theme = signal<'light' | 'dark'>('light');
  protected readonly overview = signal<AiOverview | null>(null);
  protected readonly cards = signal<AiCard[]>([]);
  protected readonly chats = signal<AiChatSummary[]>([]);
  protected readonly activeChat = signal<{
    id: string;
    title: string;
    createdAt: string;
    messages: Array<{
      id: string;
      role: 'USER' | 'ASSISTANT';
      content: string;
      createdAt: string;
    }>;
  } | null>(null);
  protected readonly selectedCardId = signal<string | null>(null);

  protected readonly messageForm = this.formBuilder.group({
    message: ['', [Validators.required, Validators.maxLength(8000)]],
  });

  protected readonly savedProjectCards = computed(() =>
    this.cards().filter((card) => card.kind === 'project'),
  );
  protected readonly savedReportCards = computed(() =>
    this.cards().filter((card) => card.kind === 'report'),
  );
  protected readonly selectedCard = computed(
    () => this.cards().find((card) => card.id === this.selectedCardId()) ?? null,
  );
  protected readonly expenseBars = computed<ExpenseBar[]>(() => {
    const source = [
      ...(this.overview()?.projectExpensesByType ?? []),
      ...(this.overview()?.eventExpensesByType ?? []),
    ];
    const grouped = new Map<string, { total: number; count: number }>();

    for (const row of source) {
      const key = `${row.type} · ${row.currency}`;
      const current = grouped.get(key) ?? { total: 0, count: 0 };
      current.total += Number(row.total);
      current.count += row.count;
      grouped.set(key, current);
    }

    const maxTotal = Math.max(...Array.from(grouped.values()).map((row) => row.total), 0);

    return Array.from(grouped.entries())
      .map(([label, row]) => ({
        label,
        total: row.total,
        count: row.count,
        width: maxTotal > 0 ? (row.total / maxTotal) * 100 : 0,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 6);
  });
  protected readonly totalExpensesLabel = computed(() => {
    const overview = this.overview();

    if (!overview) {
      return '0';
    }

    return (
      Number(overview.totals.projectExpenses) + Number(overview.totals.eventExpenses)
    ).toFixed(2);
  });

  constructor() {
    this.loadInitialData();
  }

  protected toggleTheme(): void {
    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }

  protected refresh(): void {
    this.supportLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      overview: this.aiService.overview(),
      cards: this.aiService.cards(),
      chats: this.aiService.chats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, cards, chats }) => {
          this.overview.set(overview);
          this.cards.set(cards);
          this.chats.set(chats);
          if (!this.selectedCardId() && cards.length) {
            this.selectedCardId.set(cards[0].id);
          }
          this.supportLoading.set(false);
        },
        error: (error: unknown) => {
          this.supportLoading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected createChat(): void {
    this.chatLoading.set(true);
    this.chatErrorMessage.set(null);

    this.aiService
      .createChat({})
      .pipe(
        switchMap((chat) =>
          forkJoin({
            chat: this.aiService.chat(chat.id),
            chats: this.aiService.chats(),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ chat, chats }) => {
          this.activeChat.set(chat);
          this.chats.set(chats);
          this.chatLoading.set(false);
        },
        error: (error: unknown) => {
          this.chatLoading.set(false);
          this.chatErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected selectChat(chat: AiChatSummary): void {
    this.chatLoading.set(true);
    this.chatErrorMessage.set(null);

    this.aiService
      .chat(chat.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.activeChat.set(details);
          this.chatLoading.set(false);
        },
        error: (error: unknown) => {
          this.chatLoading.set(false);
          this.chatErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected selectCard(card: AiCard): void {
    this.selectedCardId.set(card.id);
  }

  protected submitMessage(): void {
    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const rawMessage = this.messageForm.controls.message.value.trim();

    if (!rawMessage) {
      return;
    }

    this.sending.set(true);
    this.chatErrorMessage.set(null);

    const sendToChat = (chatId: string) =>
      this.aiService.sendMessage(chatId, {
        message: rawMessage,
      });

    const request$ = this.activeChat()
      ? sendToChat(this.activeChat()!.id)
      : this.aiService.createChat({}).pipe(switchMap((chat) => sendToChat(chat.id)));

    request$
      .pipe(
        switchMap((chat) =>
          forkJoin({
            chat: this.aiService.chat(chat.id),
            chats: this.aiService.chats(),
            cards: this.aiService.cards(),
            overview: this.aiService.overview(),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ chat, chats, cards, overview }) => {
          this.activeChat.set(chat);
          this.chats.set(chats);
          this.cards.set(cards);
          this.overview.set(overview);
          if (!this.selectedCardId() && cards.length) {
            this.selectedCardId.set(cards[0].id);
          }
          this.messageForm.reset({
            message: '',
          });
          this.sending.set(false);
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.chatErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected projectIdFromCard(card: AiCard | null): string | null {
    const projectId = card?.content['projectId'];
    return typeof projectId === 'string' ? projectId : null;
  }

  protected cardRows(card: AiCard | null): Array<{ label: string; value: string }> {
    const rows = card?.content['rows'];
    return Array.isArray(rows)
      ? rows.filter(
          (row): row is { label: string; value: string } =>
            !!row &&
            typeof row === 'object' &&
            typeof (row as Record<string, unknown>)['label'] === 'string' &&
            typeof (row as Record<string, unknown>)['value'] === 'string',
        )
      : [];
  }

  protected cardText(card: AiCard | null, key: string): string {
    const value = card?.content[key];
    return typeof value === 'string' ? value : '';
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.chatErrorMessage.set(null);

    forkJoin({
      overview: this.aiService.overview(),
      cards: this.aiService.cards(),
      chats: this.aiService.chats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, cards, chats }) => {
          this.overview.set(overview);
          this.cards.set(cards);
          this.chats.set(chats);
          this.selectedCardId.set(cards[0]?.id ?? null);
          this.loading.set(false);

          if (chats.length) {
            this.selectChat(chats[0]);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.length) {
        return message.join(', ');
      }

      if (error.status === 0) {
        return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
      }
    }

    return 'Не удалось загрузить раздел ИИ-аналитики.';
  }
}
