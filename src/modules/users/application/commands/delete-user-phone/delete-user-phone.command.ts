export class DeleteUserPhoneCommand {
  constructor(
    public readonly userId: string,
    public readonly phoneId: string,
  ) {}
}
