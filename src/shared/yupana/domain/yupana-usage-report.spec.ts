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

  it('builds an email send report charged to the platform', () => {
    const entry = YupanaUsageReport.emailSend({ messageId: '<abc@titantv.com.ec>', occurredAt })

    expect(entry.itemKey).toBe('email:<abc@titantv.com.ec>')
    expect(entry.photoId).toBeNull()
    expect(entry.payload).toMatchObject({
      report_id: 'email:<abc@titantv.com.ec>',
      provider: 'cloudflare',
      kind: 'unit',
      measurement_status: 'complete',
      occurred_at: occurredAt.toISOString(),
      payload: { meter: 'email.sends', quantity: 1, unit: 'count' },
    })
    expect(entry.payload.payload).not.toHaveProperty('subject')
  })

  it('keys an email send without a message id by a fresh id', () => {
    const first = YupanaUsageReport.emailSend({ messageId: null, occurredAt })
    const second = YupanaUsageReport.emailSend({ messageId: null, occurredAt })

    expect(first.itemKey.startsWith('email:')).toBe(true)
    expect(second.itemKey.startsWith('email:')).toBe(true)
    expect(first.itemKey).not.toBe(second.itemKey)
  })

  it('keys an overlong message id by its hash', () => {
    const entry = YupanaUsageReport.emailSend({ messageId: `<${'x'.repeat(200)}>`, occurredAt })

    expect(entry.itemKey.length).toBeLessThanOrEqual(120)
    expect(entry.itemKey.startsWith('email:sha256:')).toBe(true)
    expect(entry.payload.report_id).toBe(entry.itemKey)
  })

  it('keeps a given report id on the Voyage and Modal call reports', () => {
    const voyage = YupanaUsageReport.voyagePixels({
      reportId: 'backfill:voyage:ph',
      photoId,
      eventId,
      imagePixels: 10,
      occurredAt,
    })
    const call = YupanaUsageReport.modalCall({
      reportId: 'backfill:call:pr',
      photoId,
      eventId,
      callId: 'fc-01KYSTV7CSHH9KXXV7YAHM3EVA',
      occurredAt,
    })

    expect(voyage.payload.report_id).toBe('backfill:voyage:ph')
    expect(voyage.itemKey).toBe('backfill:voyage:ph')
    expect(call?.payload.report_id).toBe('backfill:call:pr')
  })

  it('reports container telemetry as a version 3 attribution report', () => {
    const entry = YupanaUsageReport.modalAttribution({
      reportId: 'backfill:request:pr',
      containerId: 'bf-01KYSTV7CSHH9KXXV7YAHM3EVA',
      activity: 'request',
      startedAt: new Date('2026-07-15T10:00:00.000Z'),
      endedAt: new Date('2026-07-15T10:00:05.000Z'),
      served: ['fc-01KYSTV7CSHH9KXXV7YAHM3EVA'],
    })

    expect(entry.kind).toBe('usage_report')
    expect(entry.photoId).toBeNull()
    expect(entry.itemKey).toBe('backfill:request:pr')
    expect(entry.payload).toEqual({
      report_id: 'backfill:request:pr',
      schema_version: 3,
      occurred_at: '2026-07-15T10:00:00.000Z',
      provider: 'modal',
      kind: 'attribution',
      measurement_status: 'complete',
      payload: {
        meter: 'gpu.container_seconds',
        activity: 'request',
        container_id: 'bf-01KYSTV7CSHH9KXXV7YAHM3EVA',
        started_at: '2026-07-15T10:00:00.000Z',
        ended_at: '2026-07-15T10:00:05.000Z',
        served: ['fc-01KYSTV7CSHH9KXXV7YAHM3EVA'],
      },
    })
  })
})
