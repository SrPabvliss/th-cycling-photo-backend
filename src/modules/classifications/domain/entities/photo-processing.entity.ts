import { ProcessingStatus } from '@generated/prisma/client'

export class PhotoProcessing {
  private constructor(
    public readonly id: string,
    public readonly photoId: string,
    public readonly schemaVersion: string,
    public status: ProcessingStatus,
    public totalMs: number,
    public modelVersions: Record<string, string>,
    public readonly startedAt: Date,
    public completedAt: Date | null,
    public errorMessage: string | null,
  ) {}

  static create(data: {
    photoId: string
    schemaVersion: string
    modelVersions: Record<string, string>
  }): PhotoProcessing {
    return new PhotoProcessing(
      crypto.randomUUID(),
      data.photoId,
      data.schemaVersion,
      ProcessingStatus.running,
      0,
      data.modelVersions,
      new Date(),
      null,
      null,
    )
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    schemaVersion: string
    status: ProcessingStatus
    totalMs: number
    modelVersions: Record<string, string>
    startedAt: Date
    completedAt: Date | null
    errorMessage: string | null
  }): PhotoProcessing {
    return new PhotoProcessing(
      data.id,
      data.photoId,
      data.schemaVersion,
      data.status,
      data.totalMs,
      data.modelVersions,
      data.startedAt,
      data.completedAt,
      data.errorMessage,
    )
  }

  markCompleted(data: { totalMs: number }): void {
    this.status = ProcessingStatus.completed
    this.totalMs = data.totalMs
    this.completedAt = new Date()
  }

  markFailed(data: { errorMessage: string }): void {
    this.status = ProcessingStatus.failed
    this.errorMessage = data.errorMessage
    this.completedAt = new Date()
  }
}
