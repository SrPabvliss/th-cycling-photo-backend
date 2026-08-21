export class ConfirmEmailVerificationCommand {
  constructor(
    public readonly userId: string,
    public readonly code: string,
  ) {}
}
