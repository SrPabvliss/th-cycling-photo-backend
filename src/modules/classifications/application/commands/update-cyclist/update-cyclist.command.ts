export interface ColorInput {
  gearTypeId: number
  colorName: string
  colorHex: string
}

export class UpdateParticipantCommand {
  constructor(
    public readonly participantId: string,
    public readonly identifier: string | null | undefined,
    public readonly colors: ColorInput[] | undefined,
  ) {}
}
