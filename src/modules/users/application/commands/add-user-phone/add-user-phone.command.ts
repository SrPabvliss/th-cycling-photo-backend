export class AddUserPhoneCommand {
  constructor(
    public readonly userId: string,
    public readonly phoneNumber: string,
    public readonly label?: string,
    public readonly isWhatsapp?: boolean,
  ) {}
}
