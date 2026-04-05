export class SetPrimaryPhoneCommand {
  constructor(
    public readonly userId: string,
    public readonly phoneId: string,
  ) {}
}
