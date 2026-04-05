export class UpdateUserPhoneCommand {
  constructor(
    public readonly userId: string,
    public readonly phoneId: string,
    public readonly phoneNumber?: string,
    public readonly label?: string | null,
    public readonly isWhatsapp?: boolean,
  ) {}
}
