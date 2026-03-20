import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { CompaniesService } from '../../entity/company/company.service';
import { CompanyListItem } from '../../entity/company/company.models';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import { MetricCardComponent } from '../../widget/metric-card/metric-card.component';

@Component({
  selector: 'app-companies-page',
  imports: [DatePipe, ReactiveFormsModule, MetricCardComponent],
  templateUrl: './companies-page.component.html',
  styleUrl: './companies-page.component.css',
})
export class CompaniesPageComponent {
  private readonly companiesService = inject(CompaniesService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<CompanyListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly companiesWithKpp = computed(
    () => this.pageData()?.rows.filter((company) => !!company.kpp).length ?? 0,
  );
  protected readonly employeesCount = computed(
    () =>
      this.pageData()?.rows.reduce((total, company) => total + company._count.employees, 0) ?? 0,
  );

  constructor() {
    this.loadCompanies();
  }

  protected applySearch(): void {
    this.loadCompanies();
  }

  protected reload(): void {
    this.loadCompanies();
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private loadCompanies(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.companiesService
      .list({
        page: 1,
        size: 24,
        search: this.searchControl.value.trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Сервер недоступен. Запустите локальный сервер приложения на порту 3000.';
    }

    return 'Не удалось загрузить список компаний.';
  }
}
