import { randomUUID } from 'node:crypto'
import { YupanaOutboxKind } from '@generated/prisma/client'
import type { YupanaOutboxEntry } from './ports'

interface UnitReportInput {
  photoId: string
  provider: string
  meter: string
  unit: string
  quantity: number
  complete: boolean
  subject: Record<string, string>
  occurredAt: Date
}

export class YupanaUsageReport {
  static readonly SCHEMA_VERSION = 2
  static readonly MODAL_CALL_ID_PATTERN = /^fc-[0-9A-HJKMNP-TV-Z]{26}$/

  static voyagePixels(input: {
    photoId: string
    eventId: string
    imagePixels: number | null
    occurredAt: Date
  }): YupanaOutboxEntry {
    const pixels = input.imagePixels
    const observed = pixels !== null && pixels >= 0
    return YupanaUsageReport.unit({
      photoId: input.photoId,
      provider: 'voyage',
      meter: 'embedding.image_pixels',
      unit: 'pixel',
      quantity: observed ? pixels : 0,
      complete: observed,
      subject: { photo_id: input.photoId, domain_event_id: input.eventId },
      occurredAt: input.occurredAt,
    })
  }

  static modalCall(input: {
    photoId: string
    eventId: string
    callId: string
    occurredAt: Date
  }): YupanaOutboxEntry | null {
    if (!YupanaUsageReport.MODAL_CALL_ID_PATTERN.test(input.callId)) return null
    return YupanaUsageReport.unit({
      photoId: input.photoId,
      provider: 'modal',
      meter: 'gpu.function_call',
      unit: 'call',
      quantity: 1,
      complete: true,
      subject: {
        photo_id: input.photoId,
        domain_event_id: input.eventId,
        call_id: input.callId,
      },
      occurredAt: input.occurredAt,
    })
  }

  private static unit(input: UnitReportInput): YupanaOutboxEntry {
    const reportId = randomUUID()
    return {
      kind: YupanaOutboxKind.usage_report,
      itemKey: reportId,
      photoId: input.photoId,
      payload: {
        report_id: reportId,
        schema_version: YupanaUsageReport.SCHEMA_VERSION,
        occurred_at: input.occurredAt.toISOString(),
        provider: input.provider,
        kind: 'unit',
        measurement_status: input.complete ? 'complete' : 'not_observed',
        payload: {
          meter: input.meter,
          quantity: input.quantity,
          unit: input.unit,
          subject: input.subject,
        },
      },
    }
  }
}
