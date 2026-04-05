import type { AuditContext } from '@shared/application'

export interface ColorInput {
  gearTypeId: number
  colorName: string
  colorHex: string
}

export class CreateParticipantCommand {
  constructor(
    public readonly photoId: string,
    public readonly identifier: string | null,
    public readonly colors: ColorInput[],
    public readonly audit?: AuditContext,
  ) {}
}
