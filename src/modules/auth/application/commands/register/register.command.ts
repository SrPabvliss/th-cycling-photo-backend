export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phoneNumber: string,
    public readonly countryId: number,
    public readonly provinceId: number | null,
    public readonly cantonId: number | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
  ) {}
}
