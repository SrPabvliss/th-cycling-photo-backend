import type { RetouchQueueProjection } from '../../application/projections'

export interface IOperatorRetouchRepository {
  getRetouchQueue(eventId: string): Promise<RetouchQueueProjection>
  isOperatorAssigned(eventId: string, operatorId: string): Promise<boolean>
}

export const OPERATOR_RETOUCH_REPOSITORY = Symbol('OPERATOR_RETOUCH_REPOSITORY')
