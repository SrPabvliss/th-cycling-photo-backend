export class RequestPasswordResetCommand {
  constructor(
    public readonly email: string,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
  ) {}
}
