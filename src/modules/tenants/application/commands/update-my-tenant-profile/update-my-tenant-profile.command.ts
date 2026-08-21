export class UpdateMyTenantProfileCommand {
  constructor(
    public readonly actorUserId: string,
    public readonly publicName: string | null | undefined,
    public readonly watermarkStorageKey: string | null | undefined,
    public readonly whatsappNumber: string | null | undefined,
  ) {}
}
