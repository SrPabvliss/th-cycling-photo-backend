import {
  PARTICIPANT_READ_REPOSITORY,
  PARTICIPANT_WRITE_REPOSITORY,
} from '@classifications/domain/ports'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '../photos/photos.module'
import { BulkClassifyHandler } from './application/commands/bulk-classify/bulk-classify.handler'
import { CreateParticipantHandler } from './application/commands/create-cyclist/create-cyclist.handler'
import { DeleteParticipantHandler } from './application/commands/delete-cyclist/delete-cyclist.handler'
import { MarkPhotoClassifiedHandler } from './application/commands/mark-photo-classified/mark-photo-classified.handler'
import { UpdateParticipantHandler } from './application/commands/update-cyclist/update-cyclist.handler'
import { GetParticipantDetailHandler } from './application/queries/get-cyclist-detail/get-cyclist-detail.handler'
import { GetGearTypesHandler } from './application/queries/get-gear-types/get-gear-types.handler'
import { GetParticipantCategoriesHandler } from './application/queries/get-participant-categories/get-participant-categories.handler'
import { GetPhotoParticipantsHandler } from './application/queries/get-photo-cyclists/get-photo-cyclists.handler'
import { ParticipantReadRepository } from './infrastructure/repositories/cyclist-read.repository'
import { ParticipantWriteRepository } from './infrastructure/repositories/cyclist-write.repository'
import { ClassificationsController } from './presentation/controllers/classifications.controller'

const CommandHandlers = [
  BulkClassifyHandler,
  CreateParticipantHandler,
  UpdateParticipantHandler,
  DeleteParticipantHandler,
  MarkPhotoClassifiedHandler,
]
const QueryHandlers = [
  GetGearTypesHandler,
  GetParticipantCategoriesHandler,
  GetPhotoParticipantsHandler,
  GetParticipantDetailHandler,
]

@Module({
  imports: [CqrsModule, PhotosModule],
  controllers: [ClassificationsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: PARTICIPANT_READ_REPOSITORY, useClass: ParticipantReadRepository },
    { provide: PARTICIPANT_WRITE_REPOSITORY, useClass: ParticipantWriteRepository },
  ],
  exports: [PARTICIPANT_READ_REPOSITORY, PARTICIPANT_WRITE_REPOSITORY],
})
export class ClassificationsModule {}
