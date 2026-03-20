export interface ListQuery {
  page?: number;
  size?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  rows: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
