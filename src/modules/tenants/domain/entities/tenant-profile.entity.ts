export class TenantProfile {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public publicName: string | null,
    public watermarkStorageKey: string | null,
    public whatsappNumber: string | null,
    public whatsappVerifiedAt: Date | null,
  ) {}

  static fromPersistence(data: {
    id: string
    name: string
    publicName: string | null
    watermarkStorageKey: string | null
    whatsappNumber: string | null
    whatsappVerifiedAt: Date | null
  }): TenantProfile {
    return new TenantProfile(
      data.id,
      data.name,
      data.publicName,
      data.watermarkStorageKey,
      data.whatsappNumber,
      data.whatsappVerifiedAt,
    )
  }

  changeBrand(publicName?: string | null, watermarkStorageKey?: string | null): void {
    if (publicName !== undefined) this.publicName = publicName
    if (watermarkStorageKey !== undefined) this.watermarkStorageKey = watermarkStorageKey
  }

  changeWhatsapp(whatsappNumber?: string | null): void {
    if (whatsappNumber === undefined) return
    if (whatsappNumber === this.whatsappNumber) return
    this.whatsappNumber = whatsappNumber
    this.whatsappVerifiedAt = null
  }

  get displayName(): string {
    return this.publicName ?? this.name
  }
}
