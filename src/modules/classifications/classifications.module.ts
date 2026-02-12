import { ClassifyPhotoHandler } from '@classifications/application/commands/classify-photo/classify-photo.handler'
import {
  CLASSIFICATION_WRITE_REPOSITORY,
  DETECTED_CYCLIST_WRITE_REPOSITORY,
  EQUIPMENT_COLOR_WRITE_REPOSITORY,
  PLATE_NUMBER_WRITE_REPOSITORY,
} from '@classifications/domain/ports'
import { ClassificationWriteRepository } from '@classifications/infrastructure/repositories/classification-write.repository'
import { DetectedCyclistWriteRepository } from '@classifications/infrastructure/repositories/detected-cyclist-write.repository'
import { EquipmentColorWriteRepository } from '@classifications/infrastructure/repositories/equipment-color-write.repository'
import { PlateNumberWriteRepository } from '@classifications/infrastructure/repositories/plate-number-write.repository'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PhotosModule } from '../photos/photos.module'

const CommandHandlers = [ClassifyPhotoHandler]

@Module({
  imports: [CqrsModule, PhotosModule],
  providers: [
    ...CommandHandlers,
    { provide: CLASSIFICATION_WRITE_REPOSITORY, useClass: ClassificationWriteRepository },
    { provide: DETECTED_CYCLIST_WRITE_REPOSITORY, useClass: DetectedCyclistWriteRepository },
    { provide: PLATE_NUMBER_WRITE_REPOSITORY, useClass: PlateNumberWriteRepository },
    { provide: EQUIPMENT_COLOR_WRITE_REPOSITORY, useClass: EquipmentColorWriteRepository },
  ],
  exports: [
    CLASSIFICATION_WRITE_REPOSITORY,
    DETECTED_CYCLIST_WRITE_REPOSITORY,
    PLATE_NUMBER_WRITE_REPOSITORY,
    EQUIPMENT_COLOR_WRITE_REPOSITORY,
  ],
})
export class ClassificationsModule {}
