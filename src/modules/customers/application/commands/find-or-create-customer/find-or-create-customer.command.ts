export class FindOrCreateCustomerCommand {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly whatsapp: string,
    public readonly email: string | null,
  ) {}
}
