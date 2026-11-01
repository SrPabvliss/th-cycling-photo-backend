import { YupanaUsageReport } from './yupana-usage-report'

describe('YupanaUsageReport', () => {
  const photoId = '6f1c2a54-2f7e-4c4e-9a2b-1f0b8a2f3c11'
  const eventId = 'b0a7c9e2-5d3f-4a61-8e2c-7f9d1e4a6b22'
  const occurredAt = new Date('2026-11-01T12:00:00.000Z')

  it('reports the pixels Voyage billed as a complete unit report', () => {
    const entry = YupanaUsageReport.voyagePixels({
      photoId,
      eventId,
      imagePixels: 1705600,
      occurredAt,
    })

    expect(entry.kind).toBe('usage_report')
    expect(entry.photoId).toBe(photoId)
    expect(entry.itemKey).toBe(entry.payload.report_id)
    expect(entry.payload).toEqual({
      report_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      schema_version: 2,
      occurred_at: '2026-11-01T12:00:00.000Z',
      provider: 'voyage',
      kind: 'unit',
      measurement_status: 'complete',
      payload: {
        meter: 'embedding.image_pixels',
        quantity: 1705600,
        unit: 'pixel',
        subject: { photo_id: photoId, domain_event_id: eventId },
      },
    })
  })

  it('never reports a missing pixel count as a zero', () => {
    const entry = YupanaUsageReport.voyagePixels({
      photoId,
      eventId,
      imagePixels: null,
      occurredAt,
    })

    expect(entry.payload).toMatchObject({
      measurement_status: 'not_observed',
      payload: { quantity: 0 },
    })
  })

  it('gives every report its own id', () => {
    const input = { photoId, eventId, imagePixels: 10, occurredAt }

    expect(YupanaUsageReport.voyagePixels(input).itemKey).not.toBe(
      YupanaUsageReport.voyagePixels(input).itemKey,
    )
  })

  it('reports a Modal call with its call id', () => {
    const entry = YupanaUsageReport.modalCall({
      photoId,
      eventId,
      callId: 'fc-01JABCDEFGHJKMNPQRSTVWXYZ0',
      occurredAt,
    })

    expect(entry?.payload).toMatchObject({
      provider: 'modal',
      kind: 'unit',
      measurement_status: 'complete',
      payload: {
        meter: 'gpu.function_call',
        quantity: 1,
        unit: 'call',
        subject: {
          photo_id: photoId,
          domain_event_id: eventId,
          call_id: 'fc-01JABCDEFGHJKMNPQRSTVWXYZ0',
        },
      },
    })
  })

  it('drops a call id that is not a Modal function call id', () => {
    expect(YupanaUsageReport.modalCall({ photoId, eventId, callId: 'abc', occurredAt })).toBeNull()
  })
})
