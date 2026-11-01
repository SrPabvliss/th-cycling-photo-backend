import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  type DeclarablePhoto,
  type IYupanaOutboxRepository,
  type IYupanaPhotoDeclarer,
  YUPANA_OUTBOX_REPOSITORY,
} from '../../domain/ports'
import { YupanaPhotoDeclaration } from '../../domain/yupana-photo-declaration'

@Injectable()
export class YupanaPhotoDeclarerService implements IYupanaPhotoDeclarer {
  private readonly bucket: string

  constructor(
    @Inject(YUPANA_OUTBOX_REPOSITORY) private readonly outbox: IYupanaOutboxRepository,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('storage.b2.bucketName', '') ?? ''
  }

  async declareStored(photos: DeclarablePhoto[], tx: Prisma.TransactionClient): Promise<void> {
    const declaredAt = new Date()
    await this.outbox.enqueue(
      photos.map((photo) => this.declaration(photo, null, declaredAt)),
      tx,
    )
  }

  async declareResized(photo: DeclarablePhoto, tx: Prisma.TransactionClient): Promise<void> {
    if (!(await this.outbox.existsDeclarationForPhoto(photo.id))) return
    await this.outbox.enqueue([this.declaration(photo, null, new Date())], tx)
  }

  async declareRemoved(photo: DeclarablePhoto, tx: Prisma.TransactionClient): Promise<void> {
    if (!(await this.outbox.existsDeclarationForPhoto(photo.id))) return
    const removedAt = new Date()
    await this.outbox.enqueue([this.declaration(photo, removedAt, removedAt)], tx)
  }

  private declaration(photo: DeclarablePhoto, storedUntil: Date | null, declaredAt: Date) {
    return YupanaPhotoDeclaration.of({
      photoId: photo.id,
      eventId: photo.eventId,
      bucket: this.bucket,
      bytes: photo.fileSize + (photo.retouchedFileSize ?? 0n),
      storedFrom: photo.uploadedAt,
      storedUntil,
      declaredAt,
    })
  }
}
