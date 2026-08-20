export class UpdateMyTenantProfileCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly publicName: string | null,
    public readonly watermarkStorageKey: string | null,
    public readonly whatsappNumber: string | null,
  ) {}
}
