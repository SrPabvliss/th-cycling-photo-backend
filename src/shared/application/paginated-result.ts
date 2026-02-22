import type { Pagination } from './pagination'

export class PaginatedResult<T> {
  constructor(
    public readonly items: T[],
    public readonly total: number,
    public readonly pagination: Pagination,
  ) {}

  get totalPages(): number {
    return Math.ceil(this.total / this.pagination.limit)
  }
}
