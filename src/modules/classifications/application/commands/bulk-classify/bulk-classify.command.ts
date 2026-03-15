import type { ColorInput } from '../create-cyclist/create-cyclist.command'

export class BulkClassifyCommand {
  constructor(
    public readonly photoIds: string[],
    public readonly plateNumber: number | null,
    public readonly colors: ColorInput[],
  ) {}
}
