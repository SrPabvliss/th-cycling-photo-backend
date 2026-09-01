import { ArchiveEventHandler } from '@events/application/commands/archive-event/archive-event.handler'
import { AssignOperatorHandler } from '@events/application/commands/assign-operator/assign-operator.handler'
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { DeleteEventHandler } from '@events/application/commands/delete-event/delete-event.handler'
import { RestoreEventHandler } from '@events/application/commands/restore-event/restore-event.handler'
import { SetEventFreezeHandler } from '@events/application/commands/set-event-freeze/set-event-freeze.handler'
import { UnassignOperatorHandler } from '@events/application/commands/unassign-operator/unassign-operator.handler'
import { UpdateEventHandler } from '@events/application/commands/update-event/update-event.handler'
import { UpdateEventConfigurationHandler } from '@events/application/commands/update-event-configuration/update-event-configuration.handler'
import { UpdateEventPhotoQuotaHandler } from '@events/application/commands/update-event-photo-quota/update-event-photo-quota.handler'
import { GetEventConfigurationHandler } from '@events/application/queries/get-event-configuration/get-event-configuration.handler'
import { GetEventConfigurationPresetHandler } from '@events/application/queries/get-event-configuration-preset/get-event-configuration-preset.handler'
import { GetEventCreationContextHandler } from '@events/application/queries/get-event-creation-context/get-event-creation-context.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventOperatorsHandler } from '@events/application/queries/get-event-operators/get-event-operators.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { GetEventsStatsHandler } from '@events/application/queries/get-events-stats/get-events-stats.handler'
import { GetPublicEventDetailHandler } from '@events/application/queries/get-public-event-detail/get-public-event-detail.handler'
import { GetPublicEventPhotosHandler } from '@events/application/queries/get-public-event-photos/get-public-event-photos.handler'
import { GetPublicEventsListHandler } from '@events/application/queries/get-public-events-list/get-public-events-list.handler'
import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { FreezeStateService } from '@events/application/services/freeze-state.service'
import {
  EVENT_OPERATOR_REPOSITORY,
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
} from '@events/domain/ports'
import { EventOperatorRepository } from '@events/infrastructure/repositories/event-operator.repository'
import { EventPayoutMethodRepository } from '@events/infrastructure/repositories/event-payout-method.repository'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { EventsController } from '@events/presentation/controllers/events.controller'
import { PublicEventsController } from '@events/presentation/controllers/public-events.controller'
import { LocationsModule } from '@locations/locations.module'
import { forwardRef, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UsersModule } from '@users/users.module'
import { PhotosModule } from '../photos/photos.module'

const CommandHandlers = [
  ArchiveEventHandler,
  AssignOperatorHandler,
  CreateEventHandler,
  DeleteEventHandler,
  RestoreEventHandler,
  SetEventFreezeHandler,
  UnassignOperatorHandler,
  UpdateEventHandler,
  UpdateEventConfigurationHandler,
  UpdateEventPhotoQuotaHandler,
]
const QueryHandlers = [
  GetEventsListHandler,
  GetEventDetailHandler,
  GetEventConfigurationHandler,
  GetEventConfigurationPresetHandler,
  GetEventCreationContextHandler,
  GetEventOperatorsHandler,
  GetEventsStatsHandler,
  GetPublicEventsListHandler,
  GetPublicEventDetailHandler,
  GetPublicEventPhotosHandler,
]

import { ImagesModule } from '@shared/images'
import { ContractsModule } from '../contracts/contracts.module'
import { TenantsModule } from '../tenants/tenants.module'
@Module({
  imports: [
    ImagesModule,
    CqrsModule,
    LocationsModule,
    UsersModule,
    TenantsModule,
    forwardRef(() => ContractsModule),
    forwardRef(() => PhotosModule),
  ],
  controllers: [EventsController, PublicEventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    EventConfigurationService,
    FreezeStateService,
    { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
    { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
    { provide: EVENT_OPERATOR_REPOSITORY, useClass: EventOperatorRepository },
    { provide: EVENT_PAYOUT_METHOD_REPOSITORY, useClass: EventPayoutMethodRepository },
  ],
  exports: [
    EVENT_READ_REPOSITORY,
    EVENT_WRITE_REPOSITORY,
    EVENT_OPERATOR_REPOSITORY,
    EVENT_PAYOUT_METHOD_REPOSITORY,
    FreezeStateService,
  ],
})
export class EventsModule {}
