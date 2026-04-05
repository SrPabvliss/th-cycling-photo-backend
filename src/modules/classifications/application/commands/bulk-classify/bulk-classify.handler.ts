import {
  DetectedParticipant,
  GearColor,
  ParticipantIdentifier,
} from '@classifications/domain/entities'
import {
  type IParticipantWriteRepository,
  PARTICIPANT_WRITE_REPOSITORY,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { BulkClassifyCommand } from './bulk-classify.command'

@CommandHandler(BulkClassifyCommand)
export class BulkClassifyHandler implements ICommandHandler<BulkClassifyCommand> {
  constructor(
    @Inject(PARTICIPANT_WRITE_REPOSITORY) private readonly writeRepo: IParticipantWriteRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(command: BulkClassifyCommand): Promise<{ classifiedCount: number }> {
    const uniqueIds = [...new Set(command.photoIds)]

    // Validate all photos exist in a single query
    const existingCount = await this.photoReadRepo.countByIds(uniqueIds)

    if (existingCount !== uniqueIds.length) {
      throw AppException.businessRule('classification.some_photos_not_found')
    }

    // Build domain entities for each photo
    const participants: DetectedParticipant[] = []
    const identifiers: ParticipantIdentifier[] = []
    const colors: GearColor[] = []

    for (const photoId of uniqueIds) {
      const participant = DetectedParticipant.create({ photoId })
      participants.push(participant)

      if (command.identifier !== null) {
        identifiers.push(
          ParticipantIdentifier.create({
            detectedParticipantId: participant.id,
            value: command.identifier,
          }),
        )
      }

      for (const c of command.colors) {
        colors.push(
          GearColor.create({
            detectedParticipantId: participant.id,
            gearTypeId: c.gearTypeId,
            colorName: c.colorName,
            colorHex: c.colorHex,
          }),
        )
      }
    }

    await this.writeRepo.bulkClassify({
      photoIds: uniqueIds,
      participants,
      identifiers,
      colors,
    })

    return { classifiedCount: uniqueIds.length }
  }
}
