export interface CompanyListItem {
  id: string;
  name: string;
  inn: string;
  kpp?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    employees: number;
  };
}

export interface CompanyDetails {
  id: string;
  name: string;
  inn: string;
  kpp?: string | null;
  createdAt: string;
  updatedAt: string;
  employees?: CompanyEmployee[];
}

export interface CompanyEmployee {
  id: string;
  companyId: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  vk?: string | null;
  telegram?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    inn: string;
    kpp?: string | null;
  };
}

export interface CompanyEmployeeOption {
  id: string;
  companyId: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  company: {
    id: string;
    name: string;
    inn: string;
    kpp?: string | null;
  };
}

export interface CreateCompanyPayload {
  name: string;
  inn: string;
  kpp?: string;
}

export interface UpdateCompanyPayload {
  name?: string;
  inn?: string;
  kpp?: string | null;
}

export interface CreateCompanyEmployeePayload {
  lastName: string;
  firstName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  vk?: string;
  telegram?: string;
}

export interface UpdateCompanyEmployeePayload {
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  email?: string | null;
  phone?: string | null;
  vk?: string | null;
  telegram?: string | null;
}
