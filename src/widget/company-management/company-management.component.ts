import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { take } from 'rxjs';
import { PaginatedResponse } from '../../entity/common/pagination.models';
import {
  CompanyEmployee,
  CompanyListItem,
  CreateCompanyEmployeePayload,
  CreateCompanyPayload,
  UpdateCompanyEmployeePayload,
  UpdateCompanyPayload,
} from '../../entity/company/company.models';
import { CompaniesService } from '../../entity/company/company.service';
import { ModalWindowComponent } from '../modal-window/modal-window.component';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

type CompanyFieldName = 'name' | 'inn' | 'kpp';
type EmployeeFieldName =
  | 'lastName'
  | 'firstName'
  | 'middleName'
  | 'email'
  | 'phone'
  | 'vk'
  | 'telegram';

@Component({
  selector: 'app-company-management',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    ModalWindowComponent,
    PaginationControlsComponent,
    UiIconComponent,
  ],
  templateUrl: './company-management.component.html',
  styleUrl: './company-management.component.css',
})
export class CompanyManagementComponent {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly companiesService = inject(CompaniesService);

  readonly canCreate = input(true);
  readonly canEdit = input(true);
  readonly canDelete = input(true);

  protected readonly pageSizeOptions = [8, 15, 25, 50];
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly pageData = signal<PaginatedResponse<CompanyListItem> | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(15);
  protected readonly selectedCompanyId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly expanded = signal(true);
  protected readonly dialogOpen = signal(false);
  protected readonly employeesDialogOpen = signal(false);
  protected readonly activeCompany = signal<CompanyListItem | null>(null);
  protected readonly employees = signal<CompanyEmployee[]>([]);
  protected readonly employeesLoading = signal(false);
  protected readonly employeesErrorMessage = signal<string | null>(null);
  protected readonly employeeFormOpen = signal(false);
  protected readonly employeeSubmitting = signal(false);
  protected readonly selectedEmployeeId = signal<string | null>(null);
  protected readonly employeeErrorMessage = signal<string | null>(null);
  protected readonly employeeSuccessMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly companyFieldErrors = signal<Partial<Record<CompanyFieldName, string>>>({});
  protected readonly employeeFieldErrors = signal<Partial<Record<EmployeeFieldName, string>>>({});
  protected readonly isEditing = computed(() => !!this.selectedCompanyId());
  protected readonly isEditingEmployee = computed(() => !!this.selectedEmployeeId());
  protected readonly canShowActions = computed(() => this.canEdit() || this.canDelete());
  protected readonly dialogTitle = computed(() =>
    this.isEditing() ? 'Редактирование компании' : 'Новая компания',
  );
  protected readonly headerDescription = computed(() =>
    this.canCreate() || this.canShowActions()
      ? 'Карточки компаний, реквизиты и сотрудники доступны без ручного обновления страницы.'
      : 'Список компаний доступен для просмотра.',
  );

  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    inn: ['', [Validators.required, Validators.pattern(/^\d{10}(\d{2})?$/)]],
    kpp: ['', [Validators.pattern(/^\d{9}$/)]],
  });

  protected readonly employeeForm = this.formBuilder.group({
    lastName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    middleName: [''],
    email: ['', [Validators.email]],
    phone: [''],
    vk: [''],
    telegram: [''],
  });

  constructor() {
    this.resetForCreate();
    this.resetEmployeeForm();
    this.loadCompanies();
  }

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected applySearch(): void {
    this.currentPage.set(1);
    this.loadCompanies();
  }

  protected reload(): void {
    this.loadCompanies();
  }

  protected changePage(page: number): void {
    this.currentPage.set(page);
    this.loadCompanies();
  }

  protected changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadCompanies();
  }

  protected openCreateDialog(): void {
    if (!this.canCreate()) {
      return;
    }

    this.resetForCreate();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.companyFieldErrors.set({});
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.errorMessage.set(null);
    this.companyFieldErrors.set({});
    this.resetForCreate();
  }

  protected editCompany(company: CompanyListItem): void {
    if (!this.canEdit()) {
      return;
    }

    this.selectedCompanyId.set(company.id);
    this.form.reset({
      name: company.name,
      inn: company.inn,
      kpp: company.kpp ?? '',
    });
    this.companyFieldErrors.set({});
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogOpen.set(true);
  }

  protected submit(): void {
    const selectedCompanyId = this.selectedCompanyId();

    if ((selectedCompanyId && !this.canEdit()) || (!selectedCompanyId && !this.canCreate())) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.companyFieldErrors.set({});

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
            this.handleCompanyError(error);
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
          this.currentPage.set(1);
          this.resetForCreate();
          this.loadCompanies();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.handleCompanyError(error);
        },
      });
  }

  protected deleteCompany(company: CompanyListItem): void {
    if (!this.canDelete()) {
      return;
    }

    const confirmation = confirm(`Удалить компанию ${company.name}?`);

    if (!confirmation) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const nextPage =
      (this.pageData()?.rows.length ?? 0) === 1 && this.currentPage() > 1
        ? this.currentPage() - 1
        : this.currentPage();

    this.companiesService
      .remove(company.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Компания удалена.');

          if (this.selectedCompanyId() === company.id) {
            this.closeDialog();
          }

          if (this.activeCompany()?.id === company.id) {
            this.closeEmployeesDialog();
          }

          this.currentPage.set(nextPage);
          this.loadCompanies();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected openEmployeesDialog(company: CompanyListItem): void {
    this.activeCompany.set(company);
    this.employeesDialogOpen.set(true);
    this.employeesErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);
    this.employeeFormOpen.set(false);
    this.resetEmployeeForm();
    this.loadEmployees(company.id);
  }

  protected closeEmployeesDialog(): void {
    this.employeesDialogOpen.set(false);
    this.activeCompany.set(null);
    this.employees.set([]);
    this.employeesLoading.set(false);
    this.employeesErrorMessage.set(null);
    this.employeeErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);
    this.employeeFormOpen.set(false);
    this.resetEmployeeForm();
  }

  protected startCreateEmployee(): void {
    if (!this.canEdit()) {
      return;
    }

    this.employeeFormOpen.set(true);
    this.employeeErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);
    this.resetEmployeeForm();
  }

  protected editEmployee(employee: CompanyEmployee): void {
    if (!this.canEdit()) {
      return;
    }

    this.selectedEmployeeId.set(employee.id);
    this.employeeForm.reset({
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      vk: employee.vk ?? '',
      telegram: employee.telegram ?? '',
    });
    this.employeeFieldErrors.set({});
    this.employeeErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);
    this.employeeFormOpen.set(true);
  }

  protected cancelEmployeeEdit(): void {
    this.employeeFormOpen.set(false);
    this.employeeErrorMessage.set(null);
    this.employeeFieldErrors.set({});
    this.resetEmployeeForm();
  }

  protected submitEmployee(): void {
    const company = this.activeCompany();

    if (!company || !this.canEdit()) {
      return;
    }

    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const selectedEmployeeId = this.selectedEmployeeId();
    this.employeeSubmitting.set(true);
    this.employeeErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);
    this.employeeFieldErrors.set({});

    const request = selectedEmployeeId
      ? this.companiesService.updateEmployee(
          company.id,
          selectedEmployeeId,
          this.buildUpdateEmployeePayload(),
        )
      : this.companiesService.createEmployee(company.id, this.buildCreateEmployeePayload());

    request.pipe(take(1)).subscribe({
      next: () => {
        this.employeeSubmitting.set(false);
        this.employeeSuccessMessage.set(
          selectedEmployeeId ? 'Сотрудник обновлён.' : 'Сотрудник добавлен.',
        );
        this.employeeFormOpen.set(false);
        this.resetEmployeeForm();
        this.loadEmployees(company.id);
        this.loadCompanies();
      },
      error: (error: unknown) => {
        this.employeeSubmitting.set(false);
        this.handleEmployeeError(error);
      },
    });
  }

  protected deleteEmployee(employee: CompanyEmployee): void {
    const company = this.activeCompany();

    if (!company || !this.canDelete()) {
      return;
    }

    const confirmation = confirm(
      `Удалить сотрудника ${employee.lastName} ${employee.firstName}?`,
    );

    if (!confirmation) {
      return;
    }

    this.employeeErrorMessage.set(null);
    this.employeeSuccessMessage.set(null);

    this.companiesService
      .removeEmployee(company.id, employee.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.employeeSuccessMessage.set('Сотрудник удалён.');

          if (this.selectedEmployeeId() === employee.id) {
            this.cancelEmployeeEdit();
          }

          this.loadEmployees(company.id);
          this.loadCompanies();
        },
        error: (error: unknown) => {
          this.employeeErrorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  protected fieldInvalid(fieldName: CompanyFieldName): boolean {
    const control = this.form.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected employeeFieldInvalid(fieldName: EmployeeFieldName): boolean {
    const control = this.employeeForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected fieldError(fieldName: CompanyFieldName): string | null {
    const serverError = this.companyFieldErrors()[fieldName];

    if (serverError) {
      return serverError;
    }

    const control = this.form.controls[fieldName];

    if (!control.invalid || !(control.dirty || control.touched)) {
      return null;
    }

    if (control.errors?.['required']) {
      if (fieldName === 'name') {
        return 'Название компании обязательно.';
      }

      return 'Поле обязательно для заполнения.';
    }

    if (control.errors?.['maxlength']) {
      return 'Название компании не должно превышать 255 символов.';
    }

    if (control.errors?.['pattern']) {
      if (fieldName === 'inn') {
        return 'ИНН должен состоять из 10 или 12 цифр.';
      }

      if (fieldName === 'kpp') {
        return 'КПП должен состоять из 9 цифр.';
      }
    }

    return null;
  }

  protected employeeFieldError(fieldName: EmployeeFieldName): string | null {
    const serverError = this.employeeFieldErrors()[fieldName];

    if (serverError) {
      return serverError;
    }

    const control = this.employeeForm.controls[fieldName];

    if (!control.invalid || !(control.dirty || control.touched)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Поле обязательно для заполнения.';
    }

    if (control.errors?.['email']) {
      return 'Введите корректный email.';
    }

    return null;
  }

  protected employeeFullName(employee: CompanyEmployee): string {
    return [employee.lastName, employee.firstName, employee.middleName]
      .filter(Boolean)
      .join(' ');
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

  private resetEmployeeForm(): void {
    this.selectedEmployeeId.set(null);
    this.employeeForm.reset({
      lastName: '',
      firstName: '',
      middleName: '',
      email: '',
      phone: '',
      vk: '',
      telegram: '',
    });
    this.employeeFieldErrors.set({});
  }

  private loadCompanies(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.searchControl.value.trim();

    this.companiesService
      .list({
        page: this.currentPage(),
        size: this.pageSize(),
        search: search || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.pageData.set(response);
          this.currentPage.set(response.currentPage);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  private loadEmployees(companyId: string): void {
    this.employeesLoading.set(true);
    this.employeesErrorMessage.set(null);

    this.companiesService
      .employees(companyId)
      .pipe(take(1))
      .subscribe({
        next: (employees) => {
          this.employees.set(employees);
          this.employeesLoading.set(false);
        },
        error: (error: unknown) => {
          this.employeesLoading.set(false);
          this.employeesErrorMessage.set(this.resolveErrorMessage(error));
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

  private buildCreateEmployeePayload(): CreateCompanyEmployeePayload {
    const raw = this.employeeForm.getRawValue();

    return {
      lastName: raw.lastName.trim(),
      firstName: raw.firstName.trim(),
      middleName: raw.middleName.trim() || undefined,
      email: raw.email.trim() || undefined,
      phone: raw.phone.trim() || undefined,
      vk: raw.vk.trim() || undefined,
      telegram: raw.telegram.trim() || undefined,
    };
  }

  private buildUpdateEmployeePayload(): UpdateCompanyEmployeePayload {
    const raw = this.employeeForm.getRawValue();

    return {
      lastName: raw.lastName.trim(),
      firstName: raw.firstName.trim(),
      middleName: raw.middleName.trim() || null,
      email: raw.email.trim() || null,
      phone: raw.phone.trim() || null,
      vk: raw.vk.trim() || null,
      telegram: raw.telegram.trim() || null,
    };
  }

  private handleCompanyError(error: unknown): void {
    const message = this.resolveErrorMessage(error);
    const nextFieldErrors: Partial<Record<CompanyFieldName, string>> = {};

    if (/инн/i.test(message)) {
      nextFieldErrors.inn = message;
    }

    if (/кпп/i.test(message)) {
      nextFieldErrors.kpp = message;
    }

    if (/названи/i.test(message)) {
      nextFieldErrors.name = message;
    }

    this.companyFieldErrors.set(nextFieldErrors);
    this.errorMessage.set(message);
  }

  private handleEmployeeError(error: unknown): void {
    const message = this.resolveErrorMessage(error);
    const nextFieldErrors: Partial<Record<EmployeeFieldName, string>> = {};

    if (/email/i.test(message)) {
      nextFieldErrors.email = message;
    }

    this.employeeFieldErrors.set(nextFieldErrors);
    this.employeeErrorMessage.set(message);
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
