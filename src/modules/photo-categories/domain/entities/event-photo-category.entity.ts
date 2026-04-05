export class PhotoCategory {
  constructor(
    public readonly id: number | null,
    public name: string,
    public readonly createdAt: Date,
  ) {}

  static create(data: { name: string }): PhotoCategory {
    return new PhotoCategory(null, data.name, new Date())
  }

  static fromPersistence(data: { id: number; name: string; createdAt: Date }): PhotoCategory {
    return new PhotoCategory(data.id, data.name, data.createdAt)
  }
}
