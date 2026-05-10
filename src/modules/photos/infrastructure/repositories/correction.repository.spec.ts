import { CorrectionTargetType } from '@generated/prisma/client'
import type { PrismaService } from '@shared/infrastructure'
import { CorrectionRepository } from './correction.repository'

describe('CorrectionRepository', () => {
  let prisma: any
  let repo: CorrectionRepository

  beforeEach(() => {
    prisma = {
      correction: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn(),
    }
    repo = new CorrectionRepository(prisma as PrismaService)
  })

  describe('appendCorrection', () => {
    it('creates a row with all fields mapped', async () => {
      const created = {
        id: 'c-1',
        photo_id: 'p-1',
        target_type: 'photo_bib',
        target_id: 't-1',
        field: 'digits',
        old_value: '20',
        new_value: '42',
        reviewer_id: 'r-1',
        corrected_at: new Date(),
        reason: null,
      }
      prisma.correction.create.mockResolvedValue(created)
      const result = await repo.appendCorrection({
        photoId: 'p-1',
        targetType: CorrectionTargetType.photo_bib,
        targetId: 't-1',
        field: 'digits',
        oldValue: '20',
        newValue: '42',
        reviewerId: 'r-1',
      })
      expect(prisma.correction.create).toHaveBeenCalledWith({
        data: {
          photo_id: 'p-1',
          target_type: 'photo_bib',
          target_id: 't-1',
          field: 'digits',
          old_value: '20',
          new_value: '42',
          reviewer_id: 'r-1',
        },
      })
      expect(result).toBe(created)
    })
  })

  describe('findLatestForTarget', () => {
    it('returns null when no correction exists', async () => {
      prisma.correction.findFirst.mockResolvedValue(null)
      expect(
        await repo.findLatestForTarget(CorrectionTargetType.photo_bib, 't-1', 'digits'),
      ).toBeNull()
    })

    it('maps the row to ILatestCorrection', async () => {
      const date = new Date('2026-05-09')
      prisma.correction.findFirst.mockResolvedValue({
        id: 'c-1',
        new_value: '42',
        old_value: '20',
        corrected_at: date,
        reviewer_id: 'r-1',
      })
      const result = await repo.findLatestForTarget(CorrectionTargetType.photo_bib, 't-1', 'digits')
      expect(result).toEqual({
        id: 'c-1',
        newValue: '42',
        oldValue: '20',
        correctedAt: date,
        reviewerId: 'r-1',
      })
    })
  })

  describe('findLatestByTargets', () => {
    it('returns empty map when targets list is empty', async () => {
      const result = await repo.findLatestByTargets([])
      expect(result.size).toBe(0)
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })

    it('builds map keyed by target_type:target_id:field', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'c-1',
          target_type: 'photo_bib',
          target_id: 'b-1',
          field: 'digits',
          new_value: '42',
          old_value: '20',
          corrected_at: new Date(),
          reviewer_id: 'r-1',
        },
        {
          id: 'c-2',
          target_type: 'photo_color',
          target_id: 'col-1',
          field: 'primary_color',
          new_value: 'rojo',
          old_value: 'azul',
          corrected_at: new Date(),
          reviewer_id: 'r-1',
        },
      ])
      const result = await repo.findLatestByTargets([
        { targetType: CorrectionTargetType.photo_bib, targetId: 'b-1' },
        { targetType: CorrectionTargetType.photo_color, targetId: 'col-1' },
      ])
      expect(result.size).toBe(2)
      expect(result.get('photo_bib:b-1:digits')?.newValue).toBe('42')
      expect(result.get('photo_color:col-1:primary_color')?.newValue).toBe('rojo')
    })
  })
})
