export class CreateOrderFromPreviewCommand {
  constructor(
    public readonly token: string,
    public readonly photoIds: string[],
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly whatsapp: string,
    public readonly email: string | null,
    public readonly notes: string | null,
  ) {}
}
