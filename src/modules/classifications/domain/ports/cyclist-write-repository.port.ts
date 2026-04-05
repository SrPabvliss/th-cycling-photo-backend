import type { DetectedParticipant, GearColor, ParticipantIdentifier } from '../entities'

export interface BulkClassifyInput {
  photoIds: string[]
  participants: DetectedParticipant[]
  identifiers: ParticipantIdentifier[]
  colors: GearColor[]
}

export interface IParticipantWriteRepository {
  saveParticipant(participant: DetectedParticipant): Promise<DetectedParticipant>
  saveIdentifier(identifier: ParticipantIdentifier): Promise<ParticipantIdentifier>
  saveColors(colors: GearColor[]): Promise<void>
  deleteColorsByParticipant(participantId: string): Promise<void>
  deleteIdentifierByParticipant(participantId: string): Promise<void>
  deleteParticipant(id: string): Promise<void>
  bulkClassify(input: BulkClassifyInput): Promise<void>
}

export const PARTICIPANT_WRITE_REPOSITORY = Symbol('PARTICIPANT_WRITE_REPOSITORY')
