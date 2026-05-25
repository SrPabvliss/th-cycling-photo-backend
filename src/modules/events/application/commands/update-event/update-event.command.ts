import type { AuditContext } from '@shared/application'

export class UpdateEventCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly provinceId?: number | null,
    public readonly cantonId?: number | null,
    public readonly eventTypeId?: number,
    public readonly audit?: AuditContext,
  ) {}
}
