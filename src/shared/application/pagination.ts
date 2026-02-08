export class Pagination {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}

  get skip(): number {
    return (this.page - 1) * this.limit
  }

  get take(): number {
    return this.limit
  }
}
