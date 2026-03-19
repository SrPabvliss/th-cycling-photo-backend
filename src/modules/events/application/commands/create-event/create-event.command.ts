import type { AuditContext } from '@shared/application'

export class CreateEventCommand {
  constructor(
    public readonly name: string,
    public readonly date: Date,
    public readonly location: string | null,
    public readonly provinceId: number | null,
    public readonly cantonId: number | null,
    public readonly audit?: AuditContext,
  ) {}
}
