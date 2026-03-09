import { CYCLIST_READ_REPOSITORY, CYCLIST_WRITE_REPOSITORY } from '@classifications/domain/ports'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '../photos/photos.module'
import { CreateCyclistHandler } from './application/commands/create-cyclist/create-cyclist.handler'
import { DeleteCyclistHandler } from './application/commands/delete-cyclist/delete-cyclist.handler'
import { MarkPhotoClassifiedHandler } from './application/commands/mark-photo-classified/mark-photo-classified.handler'
import { UpdateCyclistHandler } from './application/commands/update-cyclist/update-cyclist.handler'
import { GetCyclistDetailHandler } from './application/queries/get-cyclist-detail/get-cyclist-detail.handler'
import { GetPhotoCyclistsHandler } from './application/queries/get-photo-cyclists/get-photo-cyclists.handler'
import { CyclistReadRepository } from './infrastructure/repositories/cyclist-read.repository'
import { CyclistWriteRepository } from './infrastructure/repositories/cyclist-write.repository'
import { ClassificationsController } from './presentation/controllers/classifications.controller'

const CommandHandlers = [
  CreateCyclistHandler,
  UpdateCyclistHandler,
  DeleteCyclistHandler,
  MarkPhotoClassifiedHandler,
]
const QueryHandlers = [GetPhotoCyclistsHandler, GetCyclistDetailHandler]

@Module({
  imports: [CqrsModule, PhotosModule],
  controllers: [ClassificationsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: CYCLIST_READ_REPOSITORY, useClass: CyclistReadRepository },
    { provide: CYCLIST_WRITE_REPOSITORY, useClass: CyclistWriteRepository },
  ],
  exports: [CYCLIST_READ_REPOSITORY, CYCLIST_WRITE_REPOSITORY],
})
export class ClassificationsModule {}
