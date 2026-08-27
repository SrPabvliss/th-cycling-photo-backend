export class GetContractByTokenQuery {
  constructor(
    public readonly token: string,
    public readonly userId: string,
  ) {}
}
