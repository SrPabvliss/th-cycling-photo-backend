import type { RetouchOrderScope } from '../../../domain/ports'

export class GetRetouchQueueQuery {
  constructor(
    public readonly eventSlug: string,
    public readonly operatorId: string,
    public readonly scope: RetouchOrderScope,
  ) {}
}
