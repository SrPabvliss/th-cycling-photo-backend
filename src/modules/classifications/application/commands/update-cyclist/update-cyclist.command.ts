export interface ColorInput {
  itemType: string
  colorName: string
  colorHex: string
}

export class UpdateCyclistCommand {
  constructor(
    public readonly cyclistId: string,
    public readonly plateNumber: number | null | undefined,
    public readonly colors: ColorInput[] | undefined,
  ) {}
}
