import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module'
import { GetParticipantCategoriesHandler } from './application/queries/get-participant-categories'
import { PARTICIPANT_CATEGORY_READ_REPOSITORY } from './domain/ports'
import { ParticipantCategoryReadRepository } from './infrastructure/repositories/participant-category-read.repository'
import { ParticipantCategoriesController } from './presentation/controllers/participant-categories.controller'

@Module({
  imports: [CqrsModule, PrismaModule],
  controllers: [ParticipantCategoriesController],
  providers: [
    GetParticipantCategoriesHandler,
    {
      provide: PARTICIPANT_CATEGORY_READ_REPOSITORY,
      useClass: ParticipantCategoryReadRepository,
    },
  ],
})
export class ParticipantCategoriesModule {}
