import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '@shared/auth'
import { OperatorController } from './operator.controller'

describe('OperatorController (roles metadata)', () => {
  const reflector = new Reflector()

  const getRoles = (methodName: keyof OperatorController): string[] | undefined => {
    const handler = OperatorController.prototype[methodName] as unknown as (
      ...args: unknown[]
    ) => unknown
    return reflector.get<string[]>(ROLES_KEY, handler)
  }

  describe('admin + operator endpoints', () => {
    it('getReviewQueue accepts admin and operator', () => {
      expect(getRoles('getReviewQueue')).toEqual(expect.arrayContaining(['admin', 'operator']))
    })

    it('getRetouchQueue accepts admin and operator', () => {
      expect(getRoles('getRetouchQueue')).toEqual(expect.arrayContaining(['admin', 'operator']))
    })

    it('getRetouchOrders accepts admin and operator', () => {
      expect(getRoles('getRetouchOrders')).toEqual(expect.arrayContaining(['admin', 'operator']))
    })

    it('getRetouchOrderDetail accepts admin and operator', () => {
      expect(getRoles('getRetouchOrderDetail')).toEqual(
        expect.arrayContaining(['admin', 'operator']),
      )
    })
  })

  describe('operator-only endpoints', () => {
    it('getSummary remains operator-only', () => {
      expect(getRoles('getSummary')).toEqual(['operator'])
    })

    it('getActiveEvents remains operator-only', () => {
      expect(getRoles('getActiveEvents')).toEqual(['operator'])
    })

    it('getCompletedEvents remains operator-only', () => {
      expect(getRoles('getCompletedEvents')).toEqual(['operator'])
    })

    it('getRecentActivity remains operator-only', () => {
      expect(getRoles('getRecentActivity')).toEqual(['operator'])
    })
  })
})
