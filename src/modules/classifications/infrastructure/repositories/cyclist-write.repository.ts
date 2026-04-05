import type {
  DetectedParticipant,
  GearColor,
  ParticipantIdentifier,
} from '@classifications/domain/entities'
import type { BulkClassifyInput, IParticipantWriteRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as ParticipantMapper from '../mappers/cyclist.mapper'

@Injectable()
export class ParticipantWriteRepository implements IParticipantWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates or updates a detected participant record. */
  async saveParticipant(participant: DetectedParticipant): Promise<DetectedParticipant> {
    const data = ParticipantMapper.toParticipantPersistence(participant)
    const saved = await this.prisma.detectedParticipant.upsert({
      where: { id: participant.id },
      create: data,
      update: data,
    })
    return ParticipantMapper.toEntity(saved)
  }

  /** Creates or updates a participant identifier record. */
  async saveIdentifier(identifier: ParticipantIdentifier): Promise<ParticipantIdentifier> {
    const data = ParticipantMapper.toIdentifierPersistence(identifier)
    const saved = await this.prisma.participantIdentifier.upsert({
      where: { id: identifier.id },
      create: data,
      update: data,
    })
    return ParticipantMapper.toIdentifierEntity(saved)
  }

  /** Saves a batch of gear colors. */
  async saveColors(colors: GearColor[]): Promise<void> {
    if (colors.length === 0) return
    await this.prisma.gearColor.createMany({
      data: colors.map(ParticipantMapper.toColorPersistence),
    })
  }

  /** Deletes all gear colors for a given participant. */
  async deleteColorsByParticipant(participantId: string): Promise<void> {
    await this.prisma.gearColor.deleteMany({
      where: { detected_participant_id: participantId },
    })
  }

  /** Deletes the identifier for a given participant. */
  async deleteIdentifierByParticipant(participantId: string): Promise<void> {
    await this.prisma.participantIdentifier.deleteMany({
      where: { detected_participant_id: participantId },
    })
  }

  /** Deletes a participant and all related records (cascade). */
  async deleteParticipant(id: string): Promise<void> {
    await this.prisma.detectedParticipant.delete({ where: { id } })
  }

  /** Applies the same classification to multiple photos in a single transaction. */
  async bulkClassify(input: BulkClassifyInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing classifications for all target photos
      await tx.detectedParticipant.deleteMany({
        where: { photo_id: { in: input.photoIds } },
      })

      // Create new participants
      await tx.detectedParticipant.createMany({
        data: input.participants.map(ParticipantMapper.toParticipantPersistence),
      })

      // Create identifiers
      if (input.identifiers.length > 0) {
        await tx.participantIdentifier.createMany({
          data: input.identifiers.map(ParticipantMapper.toIdentifierPersistence),
        })
      }

      // Create gear colors
      if (input.colors.length > 0) {
        await tx.gearColor.createMany({
          data: input.colors.map(ParticipantMapper.toColorPersistence),
        })
      }

      // Mark all photos as classified
      await tx.photo.updateMany({
        where: { id: { in: input.photoIds } },
        data: { classified_at: new Date() },
      })
    })
  }
}
