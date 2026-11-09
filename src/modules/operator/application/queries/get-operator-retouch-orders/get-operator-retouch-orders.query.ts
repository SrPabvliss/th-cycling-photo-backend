import { Pagination } from '@shared/application'
import type { RetouchOrderScope } from '../../../domain/ports'

export class GetOperatorRetouchOrdersQuery {
  constructor(
    public readonly operatorId: string,
    public readonly pagination: Pagination,
    public readonly scope: RetouchOrderScope,
    public readonly eventSlug: string | null,
  ) {}
}
