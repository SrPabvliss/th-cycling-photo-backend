import { YupanaOutboxKind } from '@generated/prisma/client'
import type { YupanaOutboxEntry } from './ports'

export class YupanaPhotoDeclaration {
  static of(input: {
    photoId: string
    eventId: string
    bucket: string
    bytes: bigint
    storedFrom: Date
    storedUntil: Date | null
    declaredAt: Date
  }): YupanaOutboxEntry {
    const declaredAt = input.declaredAt.toISOString()
    return {
      kind: YupanaOutboxKind.photo_declaration,
      itemKey: `${input.photoId}@${declaredAt}`,
      photoId: input.photoId,
      payload: {
        photo_id: input.photoId,
        domain_event_id: input.eventId,
        bucket: input.bucket,
        bytes: Number(input.bytes),
        stored_from: input.storedFrom.toISOString(),
        ...(input.storedUntil ? { stored_until: input.storedUntil.toISOString() } : {}),
        declared_at: declaredAt,
      },
    }
  }
}
