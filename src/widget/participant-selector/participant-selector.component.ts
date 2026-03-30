import { Component, computed, input, output, signal } from '@angular/core';

export interface ParticipantSelectorOption {
  id: string;
  label: string;
  searchTerms?: string[];
}

@Component({
  selector: 'app-participant-selector',
  templateUrl: './participant-selector.component.html',
  styleUrl: './participant-selector.component.css',
})
export class ParticipantSelectorComponent {
  readonly options = input<ParticipantSelectorOption[]>([]);
  readonly selectedIds = input<string[]>([]);
  readonly multiple = input(true);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly searchPlaceholder = input('Найти участника');
  readonly noResultsText = input('Пользователи не найдены.');
  readonly listSize = input(8);
  readonly selectionChange = output<string[]>();

  protected readonly searchTerm = signal('');
  protected readonly filteredOptions = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();

    if (!query) {
      return this.options();
    }

    return this.options().filter((option) => {
      const haystack = [option.label, ...(option.searchTerms ?? [])]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });
  protected readonly selectedLabels = computed(() => {
    const optionsById = new Map(this.options().map((option) => [option.id, option.label]));

    return this.selectedIds()
      .map((id) => optionsById.get(id))
      .filter((label): label is string => !!label);
  });
  protected readonly effectiveListSize = computed(() => {
    const optionsCount = this.filteredOptions().length || 1;
    return Math.max(4, Math.min(this.listSize(), optionsCount));
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
  }

  protected isSelected(optionId: string): boolean {
    return this.selectedIds().includes(optionId);
  }

  protected handleSelectionChange(event: Event): void {
    const element = event.target as HTMLSelectElement;

    if (this.multiple()) {
      const selectedIds = Array.from(element.selectedOptions)
        .map((option) => option.value.trim())
        .filter(Boolean);

      this.selectionChange.emit(selectedIds);
      return;
    }

    const selectedId = element.value.trim();
    this.selectionChange.emit(selectedId ? [selectedId] : []);
  }
}
