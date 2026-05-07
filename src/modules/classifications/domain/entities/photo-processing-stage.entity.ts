import { ProcessingStageName, ProcessingStageStatus } from '@generated/prisma/client'

export class PhotoProcessingStage {
  private constructor(
    public readonly id: string,
    public readonly photoProcessingId: string,
    public readonly stage: ProcessingStageName,
    public readonly status: ProcessingStageStatus,
    public readonly ms: number,
    public readonly itemsProcessed: number,
    public readonly itemsSucceeded: number,
    public readonly itemsFailed: number,
    public readonly notes: string[],
  ) {}

  static create(data: {
    photoProcessingId: string
    stage: ProcessingStageName
    status: ProcessingStageStatus
    ms: number
    itemsProcessed: number
    itemsSucceeded: number
    itemsFailed: number
    notes: string[]
  }): PhotoProcessingStage {
    return new PhotoProcessingStage(
      crypto.randomUUID(),
      data.photoProcessingId,
      data.stage,
      data.status,
      data.ms,
      data.itemsProcessed,
      data.itemsSucceeded,
      data.itemsFailed,
      data.notes,
    )
  }

  static fromPersistence(data: {
    id: string
    photoProcessingId: string
    stage: ProcessingStageName
    status: ProcessingStageStatus
    ms: number
    itemsProcessed: number
    itemsSucceeded: number
    itemsFailed: number
    notes: string[]
  }): PhotoProcessingStage {
    return new PhotoProcessingStage(
      data.id,
      data.photoProcessingId,
      data.stage,
      data.status,
      data.ms,
      data.itemsProcessed,
      data.itemsSucceeded,
      data.itemsFailed,
      data.notes,
    )
  }
}
