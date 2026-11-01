import { YupanaPhotoDeclaration } from './yupana-photo-declaration'

describe('YupanaPhotoDeclaration', () => {
  const photoId = '6f1c2a54-2f7e-4c4e-9a2b-1f0b8a2f3c11'
  const eventId = 'b0a7c9e2-5d3f-4a61-8e2c-7f9d1e4a6b22'
  const storedFrom = new Date('2026-11-01T12:00:00.000Z')
  const declaredAt = new Date('2026-11-01T12:00:05.000Z')

  it('declares a stored photo without an end', () => {
    const entry = YupanaPhotoDeclaration.of({
      photoId,
      eventId,
      bucket: 'cycling-photo-dev',
      bytes: 2_048_000n,
      storedFrom,
      storedUntil: null,
      declaredAt,
    })

    expect(entry).toEqual({
      kind: 'photo_declaration',
      itemKey: `${photoId}@2026-11-01T12:00:05.000Z`,
      photoId,
      payload: {
        photo_id: photoId,
        domain_event_id: eventId,
        bucket: 'cycling-photo-dev',
        bytes: 2048000,
        stored_from: '2026-11-01T12:00:00.000Z',
        declared_at: '2026-11-01T12:00:05.000Z',
      },
    })
  })

  it('declares the end of storage when the photo is gone', () => {
    const entry = YupanaPhotoDeclaration.of({
      photoId,
      eventId,
      bucket: 'cycling-photo-dev',
      bytes: 2_048_000n,
      storedFrom,
      storedUntil: declaredAt,
      declaredAt,
    })

    expect(entry.payload.stored_until).toBe('2026-11-01T12:00:05.000Z')
  })
})
