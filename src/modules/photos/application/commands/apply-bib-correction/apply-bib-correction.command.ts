export class ApplyBibCorrectionCommand {
  constructor(
    public readonly photoId: string,
    public readonly bibId: string,
    public readonly newValue: string,
    public readonly reviewerId: string,
  ) {}
}
