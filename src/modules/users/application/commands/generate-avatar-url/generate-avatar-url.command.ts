export class GenerateAvatarUrlCommand {
  constructor(
    public readonly userId: string,
    public readonly fileName: string,
    public readonly contentType: string,
  ) {}
}
