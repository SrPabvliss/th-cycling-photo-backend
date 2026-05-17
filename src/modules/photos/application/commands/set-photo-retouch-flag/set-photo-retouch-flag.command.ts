export class SetPhotoRetouchFlagCommand {
  constructor(
    public readonly photoId: string,
    public readonly value: boolean,
  ) {}
}
