import { createHash } from 'node:crypto'
import type { YupanaOutboxEntry } from './ports'
import { YupanaPhotoDeclaration } from './yupana-photo-declaration'
import { YupanaUsageReport } from './yupana-usage-report'

export interface BackfillPhoto {
  id: string
  eventId: string
  fileSize: bigint
  retouchedFileSize: bigint | null
  uploadedAt: Date
  retouchedAt: Date | null
}

export interface BackfillProcessing {
  id: string
  photoId: string
  eventId: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt: Date | null
}

export interface CompletedProcessing extends BackfillProcessing {
  completedAt: Date
}

export interface BackfillInput {
  photos: BackfillPhoto[]
  processings: BackfillProcessing[]
  bucket: string
  from: Date
  to: Date
  coldStartMs: number
  idleSeconds: number
}

export interface BackfillSession {
  containerId: string
  processings: CompletedProcessing[]
}

export interface BackfillPlan {
  declarations: YupanaOutboxEntry[]
  reports: YupanaOutboxEntry[]
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ULID_LENGTH = 26
const RANDOM_BYTES = 10

export class YupanaBackfill {
  static readonly REPORT_PREFIX = 'backfill'

  static surrogateCallId(processingId: string, startedAt: Date): string {
    const randomness = createHash('sha256').update(processingId).digest().subarray(0, RANDOM_BYTES)
    let value = BigInt(startedAt.getTime()) << BigInt(RANDOM_BYTES * 8)
    value |= BigInt(`0x${randomness.toString('hex')}`)

    let encoded = ''
    for (let index = 0; index < ULID_LENGTH; index += 1) {
      encoded = CROCKFORD[Number(value & 31n)] + encoded
      value >>= 5n
    }
    return `fc-${encoded}`
  }

  static sessions(processings: CompletedProcessing[], idleSeconds: number): BackfillSession[] {
    const ordered = [...processings].sort(
      (left, right) =>
        left.startedAt.getTime() - right.startedAt.getTime() || left.id.localeCompare(right.id),
    )
    const sessions: BackfillSession[] = []
    let current: CompletedProcessing[] = []
    let lastCompletedAt = 0

    for (const processing of ordered) {
      const first = current[0]
      const sameDay =
        first !== undefined &&
        YupanaBackfill.utcDay(first.startedAt) === YupanaBackfill.utcDay(processing.startedAt)
      const withinIdle = processing.startedAt.getTime() - lastCompletedAt <= idleSeconds * 1000

      if (first !== undefined && !(sameDay && withinIdle)) {
        sessions.push(YupanaBackfill.session(current))
        current = []
        lastCompletedAt = 0
      }

      current.push(processing)
      lastCompletedAt = Math.max(lastCompletedAt, processing.completedAt.getTime())
    }

    if (current.length > 0) sessions.push(YupanaBackfill.session(current))
    return sessions
  }

  static plan(input: BackfillInput): BackfillPlan {
    const declarations = input.photos
      .filter((photo) => photo.uploadedAt < input.to)
      .map((photo) =>
        YupanaPhotoDeclaration.of({
          photoId: photo.id,
          eventId: photo.eventId,
          bucket: input.bucket,
          bytes: photo.fileSize + (photo.retouchedFileSize ?? 0n),
          storedFrom: photo.uploadedAt,
          storedUntil: null,
          declaredAt: photo.retouchedAt ?? photo.uploadedAt,
        }),
      )

    const completed = input.processings.filter(
      (processing): processing is CompletedProcessing =>
        processing.status === 'completed' &&
        processing.startedAt >= input.from &&
        processing.startedAt < input.to &&
        processing.completedAt !== null &&
        processing.completedAt >= processing.startedAt,
    )
    const sessions = YupanaBackfill.sessions(completed, input.idleSeconds)

    const calls = sessions.flatMap((session) =>
      session.processings.flatMap((processing) => {
        const call = YupanaUsageReport.modalCall({
          reportId: `${YupanaBackfill.REPORT_PREFIX}:call:${processing.id}`,
          photoId: processing.photoId,
          eventId: processing.eventId,
          callId: YupanaBackfill.callIdOf(processing),
          occurredAt: processing.startedAt,
        })
        return call === null ? [] : [call]
      }),
    )

    const telemetry = sessions.flatMap((session) =>
      YupanaBackfill.telemetryOf(session, input.coldStartMs),
    )

    return { declarations, reports: [...calls, ...telemetry] }
  }

  private static telemetryOf(session: BackfillSession, coldStartMs: number): YupanaOutboxEntry[] {
    const first = session.processings[0] as CompletedProcessing
    const stage = YupanaUsageReport.modalAttribution({
      reportId: `${YupanaBackfill.REPORT_PREFIX}:stage:${session.containerId}`,
      containerId: session.containerId,
      activity: 'stage',
      startedAt: new Date(first.startedAt.getTime() - coldStartMs),
      endedAt: first.startedAt,
      served: [],
    })
    const requests = session.processings.map((processing) =>
      YupanaUsageReport.modalAttribution({
        reportId: `${YupanaBackfill.REPORT_PREFIX}:request:${processing.id}`,
        containerId: session.containerId,
        activity: 'request',
        startedAt: processing.startedAt,
        endedAt: processing.completedAt,
        served: [YupanaBackfill.callIdOf(processing)],
      }),
    )
    return [stage, ...requests]
  }

  private static session(processings: CompletedProcessing[]): BackfillSession {
    const first = processings[0] as CompletedProcessing
    return {
      containerId: `bf-${YupanaBackfill.callIdOf(first).slice('fc-'.length)}`,
      processings,
    }
  }

  private static callIdOf(processing: BackfillProcessing): string {
    return YupanaBackfill.surrogateCallId(processing.id, processing.startedAt)
  }

  private static utcDay(instant: Date): string {
    return instant.toISOString().slice(0, 10)
  }
}
