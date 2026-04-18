export class CreateUserCommand {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly role: string,
    public readonly password: string,
  ) {}
}
