import type {
  BackfillInput,
  BackfillPhoto,
  BackfillProcessing,
  CompletedProcessing,
} from './yupana-backfill'
import { YupanaBackfill } from './yupana-backfill'

describe('YupanaBackfill', () => {
  const CALL_ID = /^fc-[0-9A-HJKMNP-TV-Z]{26}$/
  const COLD_START_MS = 15_000

  function photo(overrides: Partial<BackfillPhoto> = {}): BackfillPhoto {
    return {
      id: 'ph-june',
      eventId: 'ev-june',
      width: 4000,
      height: 3000,
      fileSize: 5_000_000n,
      retouchedFileSize: null,
      uploadedAt: new Date('2026-06-10T09:00:00.000Z'),
      retouchedAt: null,
      processedAt: new Date('2026-06-10T09:30:00.000Z'),
      hasEmbedding: true,
      ...overrides,
    }
  }

  function processing(
    id: string,
    startedAt: string,
    completedAt: string | null,
    photoId = 'ph-june',
    status: BackfillProcessing['status'] = 'completed',
  ): BackfillProcessing {
    return {
      id,
      photoId,
      eventId: 'ev-june',
      status,
      startedAt: new Date(startedAt),
      completedAt: completedAt === null ? null : new Date(completedAt),
    }
  }

  function completed(id: string, startedAt: string, completedAt: string): CompletedProcessing {
    return { ...processing(id, startedAt, completedAt), completedAt: new Date(completedAt) }
  }

  function input(overrides: Partial<BackfillInput> = {}): BackfillInput {
    return {
      photos: [photo()],
      processings: [processing('pr-1', '2026-06-10T10:00:00.000Z', '2026-06-10T10:00:05.000Z')],
      bucket: 'cycling-photo-prod',
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-11-01T00:00:00.000Z'),
      coldStartMs: COLD_START_MS,
      idleSeconds: 300,
      ...overrides,
    }
  }

  function reportsOf(plan: ReturnType<typeof YupanaBackfill.plan>, prefix: string) {
    return plan.reports.filter((entry) => entry.itemKey.startsWith(prefix))
  }

  describe('embeddingPixels', () => {
    it('scales a wide photo down to 1600 pixels of width', () => {
      expect(YupanaBackfill.embeddingPixels(4000, 3000)).toBe(1_920_000)
    })

    it('never counts more than the 2,000,000 pixels Voyage bills for one image', () => {
      expect(YupanaBackfill.embeddingPixels(3000, 4000)).toBe(2_000_000)
    })

    it('keeps a photo already narrower than 1600 pixels', () => {
      expect(YupanaBackfill.embeddingPixels(1200, 800)).toBe(960_000)
    })
  })

  describe('surrogateCallId', () => {
    const startedAt = new Date('2026-06-10T10:00:00.000Z')

    it('is a Modal call id that is the same for the same processing', () => {
      const callId = YupanaBackfill.surrogateCallId('pr-1', startedAt)
      expect(callId).toMatch(CALL_ID)
      expect(YupanaBackfill.surrogateCallId('pr-1', startedAt)).toBe(callId)
    })

    it('differs between processings', () => {
      expect(YupanaBackfill.surrogateCallId('pr-1', startedAt)).not.toBe(
        YupanaBackfill.surrogateCallId('pr-2', startedAt),
      )
    })
  })

  describe('sessions', () => {
    it('cuts a session when the next processing starts after the idle window', () => {
      const sessions = YupanaBackfill.sessions(
        [
          completed('pr-1', '2026-06-10T10:00:00.000Z', '2026-06-10T10:00:05.000Z'),
          completed('pr-2', '2026-06-10T10:03:00.000Z', '2026-06-10T10:03:05.000Z'),
          completed('pr-3', '2026-06-10T10:20:00.000Z', '2026-06-10T10:20:05.000Z'),
        ],
        300,
      )

      expect(sessions.map((session) => session.processings.map((item) => item.id))).toEqual([
        ['pr-1', 'pr-2'],
        ['pr-3'],
      ])
      expect(new Set(sessions.map((session) => session.containerId)).size).toBe(2)
    })

    it('never lets a session cross midnight UTC', () => {
      const sessions = YupanaBackfill.sessions(
        [
          completed('pr-1', '2026-06-10T23:58:00.000Z', '2026-06-10T23:58:05.000Z'),
          completed('pr-2', '2026-06-11T00:01:00.000Z', '2026-06-11T00:01:05.000Z'),
        ],
        300,
      )

      expect(sessions).toHaveLength(2)
    })
  })

  describe('plan', () => {
    it('reports the scaled pixels of an embedded photo uploaded in the range', () => {
      const [voyage] = reportsOf(YupanaBackfill.plan(input()), 'backfill:voyage:')

      expect(voyage?.itemKey).toBe('backfill:voyage:ph-june')
      expect(voyage?.payload).toMatchObject({
        provider: 'voyage',
        measurement_status: 'complete',
        occurred_at: '2026-06-10T09:30:00.000Z',
        payload: { meter: 'embedding.image_pixels', quantity: 1_920_000 },
      })
    })

    it('reports no pixels for a photo without an embedding', () => {
      const plan = YupanaBackfill.plan(input({ photos: [photo({ hasEmbedding: false })] }))
      expect(reportsOf(plan, 'backfill:voyage:')).toEqual([])
    })

    it.each([
      { width: null, height: 3000 },
      { width: 0, height: 3000 },
      { width: 4000, height: -1 },
    ])('reports no pixels for a photo with dimensions $width x $height', (dimensions) => {
      const plan = YupanaBackfill.plan(input({ photos: [photo(dimensions)] }))
      expect(reportsOf(plan, 'backfill:voyage:')).toEqual([])
    })

    it('declares a photo stored before the range but reports none of its pixels', () => {
      const plan = YupanaBackfill.plan(
        input({ photos: [photo({ uploadedAt: new Date('2026-05-20T09:00:00.000Z') })] }),
      )

      expect(plan.declarations).toHaveLength(1)
      expect(reportsOf(plan, 'backfill:voyage:')).toEqual([])
    })

    it('declares the original and the retouch together, as of the retouch', () => {
      const plan = YupanaBackfill.plan(
        input({
          photos: [
            photo({
              retouchedFileSize: 1_000_000n,
              retouchedAt: new Date('2026-06-12T08:00:00.000Z'),
            }),
          ],
        }),
      )

      expect(plan.declarations[0]?.payload).toEqual({
        photo_id: 'ph-june',
        domain_event_id: 'ev-june',
        bucket: 'cycling-photo-prod',
        bytes: 6_000_000,
        stored_from: '2026-06-10T09:00:00.000Z',
        declared_at: '2026-06-12T08:00:00.000Z',
      })
    })

    it.each([
      { completedAt: null },
      { completedAt: '2026-06-10T09:59:59.000Z' },
    ])('skips a processing completed at $completedAt', ({ completedAt }) => {
      const plan = YupanaBackfill.plan(
        input({ processings: [processing('pr-1', '2026-06-10T10:00:00.000Z', completedAt)] }),
      )

      expect(reportsOf(plan, 'backfill:call:')).toEqual([])
      expect(reportsOf(plan, 'backfill:request:')).toEqual([])
      expect(reportsOf(plan, 'backfill:stage:')).toEqual([])
    })

    it('skips a failed processing whose completion was stamped days later', () => {
      const plan = YupanaBackfill.plan(
        input({
          processings: [
            processing('pr-1', '2026-06-10T10:00:00.000Z', '2026-06-10T10:00:05.000Z'),
            processing(
              'pr-stalled',
              '2026-06-10T10:00:10.000Z',
              '2026-06-14T21:58:32.000Z',
              'ph-june',
              'failed',
            ),
          ],
        }),
      )

      expect(reportsOf(plan, 'backfill:call:').map((entry) => entry.itemKey)).toEqual([
        'backfill:call:pr-1',
      ])
      expect(reportsOf(plan, 'backfill:request:').map((entry) => entry.itemKey)).toEqual([
        'backfill:request:pr-1',
      ])
    })

    it('serves in the telemetry the same call it reports for the photo', () => {
      const plan = YupanaBackfill.plan(input())
      const [call] = reportsOf(plan, 'backfill:call:')
      const [request] = reportsOf(plan, 'backfill:request:')
      const callId = (call?.payload.payload as { subject: { call_id: string } }).subject.call_id

      expect(callId).toMatch(CALL_ID)
      expect((request?.payload.payload as { served: string[] }).served).toEqual([callId])
      expect(request?.payload.payload).toMatchObject({
        started_at: '2026-06-10T10:00:00.000Z',
        ended_at: '2026-06-10T10:00:05.000Z',
      })
    })

    it('opens each session with a cold start before its first processing', () => {
      const [stage] = reportsOf(YupanaBackfill.plan(input()), 'backfill:stage:')

      expect(stage?.payload.payload).toMatchObject({
        activity: 'stage',
        started_at: '2026-06-10T09:59:45.000Z',
        ended_at: '2026-06-10T10:00:00.000Z',
        served: [],
      })
    })

    it('sends the calls before the telemetry that serves them', () => {
      const keys = YupanaBackfill.plan(input()).reports.map((entry) => entry.itemKey)

      expect(keys.findIndex((key) => key.startsWith('backfill:call:'))).toBeLessThan(
        keys.findIndex((key) => key.startsWith('backfill:request:')),
      )
    })

    it('builds exactly the same plan when it runs again', () => {
      expect(YupanaBackfill.plan(input())).toEqual(YupanaBackfill.plan(input()))
    })
  })
})
