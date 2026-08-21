export class RequestEmailChangeCommand {
  constructor(
    public readonly userId: string,
    public readonly newEmail: string,
    public readonly currentPassword: string,
  ) {}
}
