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
