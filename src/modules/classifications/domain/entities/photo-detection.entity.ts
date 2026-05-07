export class PhotoDetection {
  private constructor(
    public readonly id: string,
    public readonly photoId: string,
    public readonly photoProcessingId: string,
    public readonly className: string,
    public readonly classId: number,
    public readonly confidence: number,
    public readonly bbox: [number, number, number, number],
  ) {}

  static create(data: {
    photoId: string
    photoProcessingId: string
    className: string
    classId: number
    confidence: number
    bbox: [number, number, number, number]
  }): PhotoDetection {
    return new PhotoDetection(
      crypto.randomUUID(),
      data.photoId,
      data.photoProcessingId,
      data.className,
      data.classId,
      data.confidence,
      data.bbox,
    )
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    photoProcessingId: string
    className: string
    classId: number
    confidence: number
    bbox: [number, number, number, number]
  }): PhotoDetection {
    return new PhotoDetection(
      data.id,
      data.photoId,
      data.photoProcessingId,
      data.className,
      data.classId,
      data.confidence,
      data.bbox,
    )
  }
}
