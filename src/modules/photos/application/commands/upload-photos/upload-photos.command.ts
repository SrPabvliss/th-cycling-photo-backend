export interface FilePayload {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

export class UploadPhotosCommand {
  constructor(
    public readonly eventId: string,
    public readonly files: FilePayload[],
  ) {}
}
