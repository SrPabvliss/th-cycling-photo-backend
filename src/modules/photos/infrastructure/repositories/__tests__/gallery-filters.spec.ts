import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { PhotoReadRepository } from '../photo-read.repository'

function makeRepo() {
  const findMany = jest.fn().mockResolvedValue([])
  const count = jest.fn().mockResolvedValue(0)
  const $queryRaw = jest.fn().mockResolvedValue([])
  const prisma = { photo: { findMany, count }, $queryRaw } as never
  const cdn = { internalUrl: (slug: string) => `cdn:${slug}` } as never
  const repo = new PhotoReadRepository(prisma, cdn, {} as never, {} as never)
  return { repo, findMany, count, $queryRaw }
}

function photoRow(id: string) {
  return {
    id,
    filename: `${id}.jpg`,
    public_slug: id,
    status: 'reviewed',
    uploaded_at: new Date('2026-01-01'),
    reviewed_at: null,
    photo_category_id: null,
    photo_category: null,
  }
}

const scope = new EventScope(true, [], [])
const page = new Pagination(1, 30)

describe('gallery filters', () => {
  it('narrows to photos with no live bib when bib=none', async () => {
    const { repo, findMany } = makeRepo()

    await repo.getPhotosList('e1', page, { bib: 'none' }, scope)

    expect(findMany.mock.calls[0][0].where.bibs).toEqual({
      none: { deleted_at: null },
    })
  })

  it('narrows to uncategorized photos without touching photo_category_id equality', async () => {
    const { repo, findMany } = makeRepo()

    await repo.getPhotosList('e1', page, { uncategorized: true }, scope)

    expect(findMany.mock.calls[0][0].where.photo_category_id).toBeNull()
  })

  it('orders by upload time descending by default', async () => {
    const { repo, findMany } = makeRepo()

    await repo.getPhotosList('e1', page, {}, scope)

    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ uploaded_at: 'desc' }, { id: 'asc' }])
  })

  it('keeps filename ordering available as an explicit choice', async () => {
    const { repo, findMany } = makeRepo()

    await repo.getPhotosList('e1', page, { sort: 'filename' }, scope)

    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ filename: 'asc' }, { id: 'asc' }])
  })

  it('restricts the page to the sold ids when sale=sold', async () => {
    const { repo, findMany, $queryRaw } = makeRepo()
    $queryRaw.mockResolvedValueOnce([{ photo_id: 'p1' }, { photo_id: 'p2' }])

    await repo.getPhotosList('e1', page, { sale: 'sold' }, scope)

    expect(findMany.mock.calls[0][0].where.id).toEqual({ in: ['p1', 'p2'] })
  })

  it('excludes the sold ids when sale=unsold', async () => {
    const { repo, findMany, $queryRaw } = makeRepo()
    $queryRaw.mockResolvedValueOnce([{ photo_id: 'p1' }])

    await repo.getPhotosList('e1', page, { sale: 'unsold' }, scope)

    expect(findMany.mock.calls[0][0].where.id).toEqual({ notIn: ['p1'] })
  })

  it('sort=no_bib_first puts bibless photos ahead of the rest', async () => {
    const { repo, findMany, $queryRaw } = makeRepo()
    // id list comes back p2-then-p1 (e.g. uploaded_at desc); p2 has a bib, p1 does not.
    findMany.mockResolvedValueOnce([{ id: 'p2' }, { id: 'p1' }])
    $queryRaw.mockResolvedValueOnce([
      { id: 'p2', rank: '5' },
      { id: 'p1', rank: null },
    ])
    findMany.mockResolvedValueOnce([photoRow('p2'), photoRow('p1')])

    const result = await repo.getPhotosList('e1', page, { sort: 'no_bib_first' }, scope)

    expect(result.items.map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ uploaded_at: 'desc' }, { id: 'asc' }])
  })

  it('sort=bib_asc re-orders the slice even when Prisma returns it shuffled', async () => {
    const { repo, findMany, $queryRaw } = makeRepo()
    findMany.mockResolvedValueOnce([{ id: 'p3' }, { id: 'p1' }, { id: 'p2' }])
    $queryRaw.mockResolvedValueOnce([
      { id: 'p1', rank: '10' },
      { id: 'p2', rank: '5' },
      { id: 'p3', rank: null },
    ])
    // Sorted order should be p2 (5), p1 (10), p3 (no bib) — but Prisma hands the slice
    // back shuffled relative to that requested order.
    findMany.mockResolvedValueOnce([photoRow('p3'), photoRow('p1'), photoRow('p2')])

    const result = await repo.getPhotosList('e1', page, { sort: 'bib_asc' }, scope)

    expect(result.items.map((i) => i.id)).toEqual(['p2', 'p1', 'p3'])
  })

  it('sort=bib_asc takes total from the full ordered id list, not the page slice', async () => {
    const { repo, findMany, $queryRaw } = makeRepo()
    const smallPage = new Pagination(1, 2)
    findMany.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])
    $queryRaw.mockResolvedValueOnce([
      { id: 'p1', rank: '1' },
      { id: 'p2', rank: '2' },
      { id: 'p3', rank: null },
    ])
    findMany.mockResolvedValueOnce([photoRow('p1'), photoRow('p2')])

    const result = await repo.getPhotosList('e1', smallPage, { sort: 'bib_asc' }, scope)

    expect(result.items.map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(result.total).toBe(3)
  })
})
