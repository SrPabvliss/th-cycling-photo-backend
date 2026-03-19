import type { AuditContext } from '@shared/application'

export interface ColorInput {
  itemType: string
  colorName: string
  colorHex: string
}

export class CreateCyclistCommand {
  constructor(
    public readonly photoId: string,
    public readonly plateNumber: number | null,
    public readonly colors: ColorInput[],
    public readonly audit?: AuditContext,
  ) {}
}
