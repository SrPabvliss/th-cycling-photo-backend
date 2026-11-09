import type { Pagination } from '@shared/application'
import type { RetouchOrderScope } from '../../../domain/ports'

export class GetRetouchQueueQuery {
  constructor(
    public readonly eventSlug: string,
    public readonly operatorId: string,
    public readonly pagination: Pagination,
    public readonly scope: RetouchOrderScope,
  ) {}
}
