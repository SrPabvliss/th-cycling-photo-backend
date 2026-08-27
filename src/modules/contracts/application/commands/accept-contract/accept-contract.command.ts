export class AcceptContractCommand {
  constructor(
    public readonly token: string,
    public readonly userId: string,
    public readonly ip: string | null,
    public readonly userAgent: string | null,
  ) {}
}
