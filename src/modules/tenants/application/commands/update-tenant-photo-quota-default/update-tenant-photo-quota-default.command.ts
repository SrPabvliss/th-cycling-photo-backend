export class UpdateTenantPhotoQuotaDefaultCommand {
  constructor(
    public readonly tenantId: string,
    public readonly quota: number | null,
  ) {}
}
