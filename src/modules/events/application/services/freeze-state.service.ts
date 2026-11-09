import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'

@Injectable()
export class FreezeStateService {
  constructor(@Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository) {}

  async assertNotFrozen(eventId: string): Promise<void> {
    if (await this.readRepo.isFrozen(eventId)) {
      throw AppException.businessRule('event.frozen_not_editable')
    }
  }
}
