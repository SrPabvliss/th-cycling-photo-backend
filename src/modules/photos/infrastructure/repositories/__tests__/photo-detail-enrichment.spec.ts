import type { PhotoDetailProjection } from '@photos/application/projections'
import { PhotoReadRepository } from '../photo-read.repository'

type OrderRow = { id: string; buyer_name: string; created_at: Date; status: string }
type WindowRow = {
  position: number
  total: number
  prev_slug: string | null
  next_slug: string | null
}
type CorrectorRow = { bib_id: string; name: string }

function makeRepo(orderRows: OrderRow[], windowRows: WindowRow[], correctorRows: CorrectorRow[]) {
  const $queryRaw = jest
    .fn()
    .mockResolvedValueOnce(orderRows)
    .mockResolvedValueOnce(windowRows)
    .mockResolvedValueOnce(correctorRows)
  const prisma = { $queryRaw } as never
  const cdn = { internalUrl: () => 'thumb' } as never
  return { repo: new PhotoReadRepository(prisma, cdn, {} as never, {} as never), $queryRaw }
}

const baseRecord = () => ({ id: 'photo-1', event_id: 'event-1' }) as never

const baseProjection = () =>
  ({
    id: 'photo-1',
    orders: [],
    position: 1,
    eventPhotoCount: 1,
    previousSlug: null,
    nextSlug: null,
    bibs: [
      { id: 'bib-1', confidence: 0.87, correctedByName: null },
      { id: 'bib-2', confidence: 0.91, correctedByName: null },
    ],
  }) as unknown as PhotoDetailProjection

describe('photo detail enrichment', () => {
  it('attaches the paid orders of a photo, newest first', async () => {
    const { repo } = makeRepo(
      [
        {
          id: 'order-2',
          buyer_name: 'Jane Doe',
          created_at: new Date('2026-08-02T00:00:00Z'),
          status: 'paid',
        },
        {
          id: 'order-1',
          buyer_name: 'John Doe',
          created_at: new Date('2026-08-01T00:00:00Z'),
          status: 'delivered',
        },
      ],
      [],
      [],
    )

    const out = await repo.enrichDetailProjection(baseRecord(), baseProjection())

    expect(out.orders.map((o) => o.id)).toEqual(['order-2', 'order-1'])
  })

  it('leaves orders empty when nobody has bought the photo', async () => {
    const { repo } = makeRepo([], [], [])
    const stale = { ...baseProjection(), orders: [{ id: 'stale' }] as never }

    const out = await repo.enrichDetailProjection(baseRecord(), stale)

    expect(out.orders).toEqual([])
  })

  it("reports the photo's position and its neighbours within the event", async () => {
    const { repo } = makeRepo(
      [],
      [
        {
          position: 412,
          total: 2428,
          prev_slug: 'prev-photo-slug',
          next_slug: 'next-photo-slug',
        },
      ],
      [],
    )

    const out = await repo.enrichDetailProjection(baseRecord(), baseProjection())

    expect(out.position).toBe(412)
    expect(out.eventPhotoCount).toBe(2428)
    expect(out.previousSlug).toBe('prev-photo-slug')
    expect(out.nextSlug).toBe('next-photo-slug')
  })

  it('names the person who corrected a bib and leaves an untouched AI reading null', async () => {
    const { repo } = makeRepo([], [], [{ bib_id: 'bib-1', name: 'Maria Reviewer' }])

    const out = await repo.enrichDetailProjection(baseRecord(), baseProjection())

    const bib1 = out.bibs.find((b: { id: string }) => b.id === 'bib-1')
    const bib2 = out.bibs.find((b: { id: string }) => b.id === 'bib-2')
    expect(bib1?.correctedByName).toBe('Maria Reviewer')
    expect(bib1?.confidence).toBe(0.87)
    expect(bib2?.correctedByName).toBeNull()
  })
})
