export type ColorCorrectionField = 'primary_color' | 'secondary_color'

export class ApplyColorCorrectionCommand {
  constructor(
    public readonly photoId: string,
    public readonly colorId: string,
    public readonly field: ColorCorrectionField,
    public readonly newValue: string | null,
    public readonly reviewerId: string,
  ) {}
}
