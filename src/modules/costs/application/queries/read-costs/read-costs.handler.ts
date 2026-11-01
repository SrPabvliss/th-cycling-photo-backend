import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IYupanaClient, YUPANA_CLIENT } from '@shared/yupana/domain/ports'
import { type CostsResource, ReadCostsQuery } from './read-costs.query'

@QueryHandler(ReadCostsQuery)
export class ReadCostsHandler implements IQueryHandler<ReadCostsQuery> {
  constructor(@Inject(YUPANA_CLIENT) private readonly yupana: IYupanaClient) {}

  async execute(query: ReadCostsQuery): Promise<unknown> {
    if (!this.yupana.isConfigured()) throw AppException.externalService('yupana')
    const { id, ...params } = query.params
    return this.yupana.read(ReadCostsHandler.pathOf(query.resource, id ?? ''), params)
  }

  private static pathOf(resource: CostsResource, id: string): string {
    const segment = encodeURIComponent(id)
    switch (resource) {
      case 'summary':
        return '/costs/periods/summary'
      case 'health':
        return '/health'
      case 'events':
        return '/costs/events'
      case 'event':
        return `/costs/events/${segment}`
      case 'photo':
        return `/costs/photos/${segment}`
    }
  }
}
