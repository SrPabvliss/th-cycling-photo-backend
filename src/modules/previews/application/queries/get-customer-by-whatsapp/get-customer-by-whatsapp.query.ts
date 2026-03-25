export class GetCustomerByWhatsAppQuery {
  constructor(
    public readonly token: string,
    public readonly whatsapp: string,
  ) {}
}
