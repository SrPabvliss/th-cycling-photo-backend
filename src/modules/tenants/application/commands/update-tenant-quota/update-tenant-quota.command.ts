export class UpdateTenantQuotaCommand {
  constructor(
    public readonly tenantId: string,
    public readonly quota: number,
  ) {}
}
