import { PhotoReadRepository } from '../photo-read.repository'

type RawBibRow = {
  photo_id: string
  digits: string
  source: 'ai' | 'reviewer'
  confidence: string | null
  status: 'read' | 'abstained' | null
  corrected: boolean
}

function makeRepo(bibRows: RawBibRow[], soldRows: Array<{ photo_id: string }>) {
  const $queryRaw = jest.fn().mockResolvedValueOnce(bibRows).mockResolvedValueOnce(soldRows)
  const prisma = { $queryRaw } as never
  const cdn = { internalUrl: () => 'thumb' } as never
  return { repo: new PhotoReadRepository(prisma, cdn, {} as never, {} as never), $queryRaw }
}

const row = (id: string) => ({
  id,
  filename: `${id}.jpg`,
  public_slug: `${id}-slug`,
  status: 'reviewed' as const,
  uploaded_at: new Date('2026-08-01T00:00:00Z'),
  reviewed_at: null,
  photo_category_id: null,
  photo_category: null,
})

describe('photo list enrichment', () => {
  it('attaches every bib of a photo and leaves a bibless photo with an empty array', async () => {
    const { repo } = makeRepo(
      [
        {
          photo_id: 'a',
          digits: '141',
          source: 'ai',
          confidence: '0.930',
          status: 'read',
          corrected: false,
        },
        {
          photo_id: 'a',
          digits: '7',
          source: 'reviewer',
          confidence: null,
          status: 'read',
          corrected: false,
        },
      ],
      [],
    )

    const out = await repo.enrichListProjections([row('a'), row('b')] as never)

    expect(out[0].bibs.map((b) => b.digits)).toEqual(['141', '7'])
    expect(out[0].bibs[0].confidence).toBe(0.93)
    expect(out[0].bibs[1].confidence).toBeNull()
    expect(out[1].bibs).toEqual([])
  })

  it('marks only the photos that are in a paid or delivered order as sold', async () => {
    const { repo } = makeRepo([], [{ photo_id: 'b' }])

    const out = await repo.enrichListProjections([row('a'), row('b')] as never)

    expect(out.map((p) => p.sold)).toEqual([false, true])
  })

  it('does not query at all for an empty page', async () => {
    const { repo, $queryRaw } = makeRepo([], [])

    const out = await repo.enrichListProjections([] as never)

    expect(out).toEqual([])
    expect($queryRaw).not.toHaveBeenCalled()
  })
})
