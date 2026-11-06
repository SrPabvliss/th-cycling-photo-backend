export class PhotoCategory {
  constructor(
    public readonly id: number | null,
    public name: string,
    /** `null` for a base category, otherwise the owning tenant. */
    public readonly tenantId: string | null,
    public readonly createdAt: Date,
  ) {}

  static create(data: { name: string; tenantId: string | null }): PhotoCategory {
    return new PhotoCategory(null, data.name.trim(), data.tenantId, new Date())
  }

  static fromPersistence(data: {
    id: number
    name: string
    tenantId: string | null
    createdAt: Date
  }): PhotoCategory {
    return new PhotoCategory(data.id, data.name, data.tenantId, data.createdAt)
  }

  get isBase(): boolean {
    return this.tenantId === null
  }

  /** A base category is open to every tenant; an own one only to its owner. */
  isAvailableTo(tenantId: string): boolean {
    return this.isBase || this.tenantId === tenantId
  }
}
