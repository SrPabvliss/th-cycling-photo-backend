import { AttributeSource, ColorRegion } from '@generated/prisma/client'

export class PhotoColor {
  private constructor(
    public readonly id: string,
    public readonly photoId: string,
    public readonly photoProcessingId: string | null,
    public readonly source: AttributeSource,
    public readonly region: ColorRegion,
    public readonly primaryColor: string,
    public readonly secondaryColor: string | null,
    public readonly confidence: number | null,
    public readonly bboxSource: [number, number, number, number] | null,
    public readonly strategy: string | null,
    public readonly processingMs: number | null,
    public readonly createdById: string | null,
    public readonly cropPath: string | null,
  ) {}

  static createFromAi(data: {
    photoId: string
    photoProcessingId: string
    region: ColorRegion
    primaryColor: string
    secondaryColor: string | null
    confidence: number
    bboxSource: [number, number, number, number]
    strategy: string
    processingMs: number
    cropPath: string | null
  }): PhotoColor {
    return new PhotoColor(
      crypto.randomUUID(),
      data.photoId,
      data.photoProcessingId,
      AttributeSource.ai,
      data.region,
      data.primaryColor,
      data.secondaryColor,
      data.confidence,
      data.bboxSource,
      data.strategy,
      data.processingMs,
      null,
      data.cropPath,
    )
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    photoProcessingId: string | null
    source: AttributeSource
    region: ColorRegion
    primaryColor: string
    secondaryColor: string | null
    confidence: number | null
    bboxSource: [number, number, number, number] | null
    strategy: string | null
    processingMs: number | null
    createdById: string | null
    cropPath: string | null
  }): PhotoColor {
    return new PhotoColor(
      data.id,
      data.photoId,
      data.photoProcessingId,
      data.source,
      data.region,
      data.primaryColor,
      data.secondaryColor,
      data.confidence,
      data.bboxSource,
      data.strategy,
      data.processingMs,
      data.createdById,
      data.cropPath,
    )
  }
}
