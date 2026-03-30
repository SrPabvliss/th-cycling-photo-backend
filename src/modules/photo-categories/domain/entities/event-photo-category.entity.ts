export class PhotoCategory {
  constructor(
    public readonly id: string,
    public name: string,
    public readonly createdAt: Date,
  ) {}

  static create(data: { name: string }): PhotoCategory {
    return new PhotoCategory(crypto.randomUUID(), data.name, new Date())
  }

  static fromPersistence(data: { id: string; name: string; createdAt: Date }): PhotoCategory {
    return new PhotoCategory(data.id, data.name, data.createdAt)
  }
}
