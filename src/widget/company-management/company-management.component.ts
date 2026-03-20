import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { take } from 'rxjs';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import {
  CompanyListItem,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from '../../entity/company/company.models';
import { CompaniesService } from '../../entity/company/company.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-company-management',
  imports: [DatePipe, ReactiveFormsModule, ModalWindowComponent, UiIconComponent],
  templateUrl: './company-management.component.html',
  styleUrl: './company-management.component.css',
})
export class CompanyManagementComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly companiesService = inject(CompaniesService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<CompanyListItem> | null>(null);
  protected readonly selectedCompanyId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly expanded = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isEditing = computed(() => !!this.selectedCompanyId());
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование компании' : 'Новая компания',
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required]],
    inn: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(12)]],
    kpp: ['', [Validators.minLength(9), Validators.maxLength(9)]],
  });

  constructor() {
    this.resetForCreate();
    this.loadCompanies();
  }

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected applySearch(): void {
    this.loadCompanies();
  }

  protected reload(): void {
    this.loadCompanies();
  }

  protected openCreateDialog(): void {
    this.resetForCreate();
    this.errorMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.errorMessage.set(null);
    this.resetForCreate();
  }

  protected editCompany(company: CompanyListItem): void {
    this.selectedCompanyId.set(company.id);
    this.form.reset({
      name: company.name,
      inn: company.inn,
      kpp: company.kpp ?? '',
    });
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const selectedCompanyId = this.selectedCompanyId();

    if (selectedCompanyId) {
      this.companiesService
        .update(selectedCompanyId, this.buildUpdatePayload())
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.dialogOpen.set(false);
            this.successMessage.set('Изменения компании сохранены.');
            this.resetForCreate();
            this.loadCompanies();
          },
          error: (error: unknown) => {
            this.submitting.set(false);
            this.errorMessage.set(this.resolveErrorMessage(error));
          },
        });

      return;
    }

    this.companiesService
      .create(this.buildCreatePayload())
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          this.successMessage.set('Компания создана.');
          this.resetForCreate();
          this.loadCompanies();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected deleteCompany(company: CompanyListItem): void {
    const confirmation = confirm(`Удалить компанию ${company.name}?`);

    if (!confirmation) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.companiesService
      .remove(company.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Компания удалена.');

          if (this.selectedCompanyId() === company.id) {
            this.closeDialog();
          }

          this.loadCompanies();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected fieldInvalid(fieldName: 'name' | 'inn' | 'kpp'): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  private resetForCreate(): void {
    this.selectedCompanyId.set(null);
    this.form.reset({
      name: '',
      inn: '',
      kpp: '',
    });
  }

  private loadCompanies(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.searchControl.value.trim();

    this.companiesService
      .list({
        page: 1,
        size: 8,
        search: search || undefined,
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

  private buildCreatePayload(): CreateCompanyPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      inn: raw.inn.trim(),
      kpp: raw.kpp.trim() || undefined,
    };
  }

  private buildUpdatePayload(): UpdateCompanyPayload {
    const raw = this.form.getRawValue();

    return {
      name: raw.name.trim(),
      inn: raw.inn.trim(),
      kpp: raw.kpp.trim() || null,
    };
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

    return 'Не удалось выполнить операцию с компаниями.';
  }
}
