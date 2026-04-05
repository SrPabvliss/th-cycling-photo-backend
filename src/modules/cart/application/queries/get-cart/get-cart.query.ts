export class GetCartQuery {
  constructor(
    public readonly userId: string | null,
    public readonly sessionId: string | null,
  ) {}
}
