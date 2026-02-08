import { AuditFields } from './audit-fields'

describe('AuditFields', () => {
  describe('initialize', () => {
    it('should create with createdAt and updatedAt set to now, deletedAt null', () => {
      const before = Date.now()
      const audit = AuditFields.initialize()
      const after = Date.now()

      expect(audit.createdAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(audit.createdAt.getTime()).toBeLessThanOrEqual(after)
      expect(audit.updatedAt.getTime()).toBe(audit.createdAt.getTime())
      expect(audit.deletedAt).toBeNull()
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute audit fields without validations', () => {
      const created = new Date('2023-01-01')
      const updated = new Date('2023-06-01')
      const audit = AuditFields.fromPersistence({
        createdAt: created,
        updatedAt: updated,
        deletedAt: null,
      })

      expect(audit.createdAt).toBe(created)
      expect(audit.updatedAt).toBe(updated)
      expect(audit.deletedAt).toBeNull()
    })

    it('should reconstitute with deletedAt value', () => {
      const deleted = new Date('2024-03-15')
      const audit = AuditFields.fromPersistence({
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-03-15'),
        deletedAt: deleted,
      })

      expect(audit.deletedAt).toBe(deleted)
    })
  })

  describe('isDeleted', () => {
    it('should return false when deletedAt is null', () => {
      const audit = AuditFields.initialize()
      expect(audit.isDeleted).toBe(false)
    })

    it('should return true when deletedAt has a value', () => {
      const audit = AuditFields.fromPersistence({
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      })
      expect(audit.isDeleted).toBe(true)
    })
  })

  describe('markUpdated', () => {
    it('should refresh updatedAt', () => {
      const audit = AuditFields.fromPersistence({
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      })
      const before = audit.updatedAt

      audit.markUpdated()

      expect(audit.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })
  })

  describe('markDeleted', () => {
    it('should set deletedAt and refresh updatedAt', () => {
      const audit = AuditFields.initialize()

      audit.markDeleted()

      expect(audit.deletedAt).toBeInstanceOf(Date)
      expect(audit.isDeleted).toBe(true)
      expect(audit.updatedAt.getTime()).toBeGreaterThanOrEqual(audit.createdAt.getTime())
    })
  })
})
