import { Component, computed, input, output } from '@angular/core';

type PaginationItem =
  | {
      type: 'page';
      value: number;
    }
  | {
      type: 'ellipsis';
      value: string;
    };

@Component({
  selector: 'app-pagination-controls',
  templateUrl: './pagination-controls.component.html',
  styleUrl: './pagination-controls.component.css',
})
export class PaginationControlsComponent {
  readonly currentPage = input(1);
  readonly totalPages = input(1);
  readonly totalCount = input(0);
  readonly pageSize = input(10);
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);
  readonly itemLabel = input('записей');

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pages = computed(() =>
    this.buildPages(this.currentPage(), Math.max(this.totalPages(), 1)),
  );

  protected readonly canGoBackward = computed(() => this.currentPage() > 1);
  protected readonly canGoForward = computed(
    () => this.currentPage() < Math.max(this.totalPages(), 1),
  );

  protected goToPage(page: number): void {
    const normalizedPage = Math.max(1, Math.min(page, Math.max(this.totalPages(), 1)));

    if (normalizedPage === this.currentPage()) {
      return;
    }

    this.pageChange.emit(normalizedPage);
  }

  protected previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  protected nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  protected changePageSize(value: string): void {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue === this.pageSize()) {
      return;
    }

    this.pageSizeChange.emit(parsedValue);
  }

  protected submitJump(value: string): void {
    if (!value.trim()) {
      return;
    }

    this.goToPage(Number(value));
  }

  private buildPages(currentPage: number, totalPages: number): PaginationItem[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => ({
        type: 'page' as const,
        value: index + 1,
      }));
    }

    const values = new Set<number>([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ]);

    if (currentPage <= 3) {
      values.add(2);
      values.add(3);
      values.add(4);
    }

    if (currentPage >= totalPages - 2) {
      values.add(totalPages - 1);
      values.add(totalPages - 2);
      values.add(totalPages - 3);
    }

    const sortedPages = [...values]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((left, right) => left - right);

    const result: PaginationItem[] = [];

    sortedPages.forEach((page, index) => {
      if (index > 0 && page - sortedPages[index - 1] > 1) {
        result.push({
          type: 'ellipsis',
          value: `ellipsis-${sortedPages[index - 1]}-${page}`,
        });
      }

      result.push({
        type: 'page',
        value: page,
      });
    });

    return result;
  }
}
