import { Reflector } from '@nestjs/core'
import { PERMISSION_KEY } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { OperatorController } from './operator.controller'

describe('OperatorController (permission metadata)', () => {
  const reflector = new Reflector()

  const getPermission = (methodName: keyof OperatorController): string | undefined => {
    const handler = OperatorController.prototype[methodName] as unknown as (
      ...args: unknown[]
    ) => unknown
    return reflector.get<string>(PERMISSION_KEY, handler)
  }

  // Task 12 replaced `@Roles` with `@RequirePermission` on this controller
  // per Appendix A of the TIT-38 plan. `@Roles` is removed from these
  // routes (RolesGuard passes through when no metadata is present), so
  // this spec now asserts the new permission key instead of the legacy role
  // list it used to check.
  describe('operator dashboard endpoints (dashboard.operator.read)', () => {
    it('getSummary requires dashboard.operator.read', () => {
      expect(getPermission('getSummary')).toBe('dashboard.operator.read')
    })

    it('getActiveEvents requires dashboard.operator.read', () => {
      expect(getPermission('getActiveEvents')).toBe('dashboard.operator.read')
    })

    it('getCompletedEvents requires dashboard.operator.read', () => {
      expect(getPermission('getCompletedEvents')).toBe('dashboard.operator.read')
    })

    it('getRecentActivity requires dashboard.operator.read', () => {
      expect(getPermission('getRecentActivity')).toBe('dashboard.operator.read')
    })
  })

  describe('review queue endpoint (dashboard.review_queue.read)', () => {
    it('getReviewQueue requires dashboard.review_queue.read', () => {
      expect(getPermission('getReviewQueue')).toBe('dashboard.review_queue.read')
    })
  })

  describe('retouch endpoints (photo.retouch.read)', () => {
    it('getRetouchOrderDetail requires photo.retouch.read', () => {
      expect(getPermission('getRetouchOrderDetail')).toBe('photo.retouch.read')
    })

    it('getRetouchOrders requires photo.retouch.read', () => {
      expect(getPermission('getRetouchOrders')).toBe('photo.retouch.read')
    })

    it('getRetouchQueue requires photo.retouch.read', () => {
      expect(getPermission('getRetouchQueue')).toBe('photo.retouch.read')
    })
  })
})
