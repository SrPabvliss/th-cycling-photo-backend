import type { AuditContext } from '@shared/application'

export class CreateEventCommand {
  constructor(
    public readonly name: string,
    public readonly date: Date,
    public readonly description: string | null,
    public readonly location: string | null,
    public readonly provinceId: number | null,
    public readonly cantonId: number | null,
    public readonly eventTypeId: number,
    public readonly audit?: AuditContext,
  ) {}
}
