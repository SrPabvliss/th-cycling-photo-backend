export class CreateTenantCommand {
  constructor(
    public readonly name: string,
    public readonly eventQuota: number,
    public readonly adminEmail: string,
    public readonly adminPasswordHash: string,
    public readonly adminFirstName: string,
    public readonly adminLastName: string,
  ) {}
}
