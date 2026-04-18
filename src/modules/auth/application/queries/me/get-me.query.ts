export class GetMeQuery {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
  ) {}
}
