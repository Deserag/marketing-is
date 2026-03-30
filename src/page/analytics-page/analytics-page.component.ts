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
import { forkJoin, of, switchMap } from 'rxjs';
import { AiService } from '../../entity/ai/ai.service';
import {
  AiCard,
  AiChatDetail,
  AiChatMessage,
  AiChatSummary,
} from '../../entity/ai/ai.models';
import { ProjectsService } from '../../entity/project/project.service';
import { ModalWindowComponent } from '../../widget/modal-window/modal-window.component';

type WorkspaceStat = {
  label: string;
  value: string;
  hint: string;
};

@Component({
  selector: 'app-analytics-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, ModalWindowComponent],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.css',
})
export class AnalyticsPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly aiService = inject(AiService);
  private readonly projectsService = inject(ProjectsService);

  protected readonly loading = signal(true);
  protected readonly supportLoading = signal(false);
  protected readonly chatLoading = signal(false);
  protected readonly sending = signal(false);
  protected readonly savingProject = signal(false);
  protected readonly savingMessageIds = signal<Record<string, boolean>>({});
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly chatErrorMessage = signal<string | null>(null);
  protected readonly cards = signal<AiCard[]>([]);
  protected readonly chats = signal<AiChatSummary[]>([]);
  protected readonly activeChat = signal<AiChatDetail | null>(null);
  protected readonly selectedCardId = signal<string | null>(null);
  protected readonly saveProjectDialogOpen = signal(false);
  protected readonly saveProjectMessage = signal<AiChatMessage | null>(null);
  protected readonly saveProjectFile = signal<File | null>(null);

  protected readonly messageForm = this.formBuilder.group({
    message: ['', [Validators.required, Validators.maxLength(8000)]],
  });

  protected readonly saveProjectForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  protected readonly savedResults = computed(() => this.cards());
  protected readonly selectedCard = computed(
    () => this.cards().find((card) => card.id === this.selectedCardId()) ?? null,
  );
  protected readonly savedMessageIds = computed(() => {
    const savedIds = new Set<string>();

    for (const card of this.savedResults().filter((item) => item.kind === 'project')) {
      const messageId = card.content['messageId'];

      if (typeof messageId === 'string' && messageId.trim()) {
        savedIds.add(messageId);
      }
    }

    return savedIds;
  });
  protected readonly workspaceStats = computed<WorkspaceStat[]>(() => [
    {
      label: 'Диалоги',
      value: String(this.chats().length),
      hint: 'Все рабочие разговоры с ассистентом.',
    },
    {
      label: 'Сохраненные результаты',
      value: String(this.savedResults().length),
      hint: 'Итоги обсуждений, которые вы решили сохранить.',
    },
    {
      label: 'Ответы в чате',
      value: String(
        this.activeChat()?.messages.filter((message) => message.role === 'ASSISTANT').length ?? 0,
      ),
      hint: 'Ответы ассистента в текущем диалоге.',
    },
  ]);

  constructor() {
    this.loadInitialData();
  }

  protected refresh(): void {
    this.supportLoading.set(true);
    this.errorMessage.set(null);

    this.loadSupportData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
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
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ chat, chats, cards }) => {
          this.activeChat.set(chat);
          this.chats.set(chats);
          this.cards.set(cards);

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

  protected openSaveProjectDialog(message: AiChatMessage): void {
    const activeChat = this.activeChat();

    if (!activeChat || message.role !== 'ASSISTANT' || this.savedMessageIds().has(message.id)) {
      return;
    }

    this.saveProjectMessage.set(message);
    this.saveProjectFile.set(null);
    this.saveProjectForm.reset({
      name: this.suggestProjectName(message.content),
    });
    this.chatErrorMessage.set(null);
    this.saveProjectDialogOpen.set(true);
  }

  protected closeSaveProjectDialog(): void {
    this.saveProjectDialogOpen.set(false);
    this.saveProjectMessage.set(null);
    this.saveProjectFile.set(null);
    this.saveProjectForm.reset({
      name: '',
    });
  }

  protected updateSaveProjectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.saveProjectFile.set(input.files?.[0] ?? null);
  }

  protected submitSaveProject(): void {
    const activeChat = this.activeChat();
    const message = this.saveProjectMessage();

    if (!activeChat || !message) {
      return;
    }

    if (this.saveProjectForm.invalid) {
      this.saveProjectForm.markAllAsTouched();
      return;
    }

    this.savingProject.set(true);
    this.chatErrorMessage.set(null);
    this.setMessageSaving(message.id, true);

    this.aiService
      .saveMessage(activeChat.id, message.id, {
        kind: 'project',
        name: this.saveProjectForm.controls.name.value.trim(),
      })
      .pipe(
        switchMap((savedCard) => {
          const file = this.saveProjectFile();
          const projectId = this.projectIdFromCard(savedCard);

          if (file && projectId) {
            return this.projectsService.uploadResultFile(projectId, file).pipe(
              switchMap(() => of(savedCard)),
            );
          }

          return of(savedCard);
        }),
        switchMap((savedCard) =>
          this.aiService.cards().pipe(
            switchMap((cards) =>
              of({
                savedCard,
                cards,
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ savedCard, cards }) => {
          this.cards.set(cards);
          this.selectedCardId.set(savedCard.id);
          this.setMessageSaving(message.id, false);
          this.savingProject.set(false);
          this.closeSaveProjectDialog();
        },
        error: (error: unknown) => {
          this.setMessageSaving(message.id, false);
          this.savingProject.set(false);
          this.chatErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected saveProjectFieldInvalid(): boolean {
    const control = this.saveProjectForm.controls.name;
    return control.invalid && (control.dirty || control.touched);
  }

  protected saveProjectFieldError(): string | null {
    const control = this.saveProjectForm.controls.name;

    if (!this.saveProjectFieldInvalid()) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Введите название проекта.';
    }

    if (control.errors?.['maxlength']) {
      return 'Название проекта не должно превышать 255 символов.';
    }

    return 'Проверьте корректность заполнения поля.';
  }

  protected isSavingMessage(messageId: string): boolean {
    return !!this.savingMessageIds()[messageId];
  }

  protected isSavedMessage(messageId: string): boolean {
    return this.savedMessageIds().has(messageId);
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

  protected cardPreview(card: AiCard | null): string {
    return (
      this.cardText(card, 'summary') ||
      this.cardText(card, 'description') ||
      this.cardText(card, 'text') ||
      this.cardText(card, 'goal') ||
      this.cardText(card, 'result')
    );
  }

  protected cardKindLabel(card: AiCard | null): string {
    switch (card?.kind) {
      case 'project':
        return 'Проект';
      case 'report':
        return 'Отчет';
      case 'note':
        return 'Заметка';
      default:
        return 'Результат';
    }
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.chatErrorMessage.set(null);

    this.loadSupportData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private loadSupportData() {
    return forkJoin({
      cards: this.aiService.cards(),
      chats: this.aiService.chats(),
    }).pipe(
      switchMap(({ cards, chats }) => {
        this.cards.set(cards);
        this.chats.set(chats);

        const nextSelectedCardId =
          this.selectedCardId() && cards.some((card) => card.id === this.selectedCardId())
            ? this.selectedCardId()
            : cards[0]?.id ?? null;

        this.selectedCardId.set(nextSelectedCardId);

        const activeChatId = this.activeChat()?.id ?? chats[0]?.id ?? null;

        if (!activeChatId) {
          this.activeChat.set(null);
          return of(null);
        }

        return this.aiService.chat(activeChatId).pipe(
          switchMap((chat) => {
            this.activeChat.set(chat);
            return of(chat);
          }),
        );
      }),
    );
  }

  private setMessageSaving(messageId: string, saving: boolean): void {
    this.savingMessageIds.update((current) => {
      if (saving) {
        return {
          ...current,
          [messageId]: true,
        };
      }

      const nextState = { ...current };
      delete nextState[messageId];
      return nextState;
    });
  }

  private suggestProjectName(content: string): string {
    const firstLine = content
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);

    if (!firstLine) {
      return 'Новый проект из ИИ';
    }

    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
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

    return 'Не удалось загрузить рабочее пространство ИИ.';
  }
}
