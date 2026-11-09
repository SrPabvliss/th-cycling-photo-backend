import type { EventPayoutMethod } from '@events/domain/entities'
import type { OrderPayoutMethodProjection } from './order-detail.projection'

export function toOrderPayoutMethod(method: EventPayoutMethod): OrderPayoutMethodProjection {
  return {
    provider: method.provider,
    isActive: method.isActive,
    sortOrder: method.sortOrder,
    receiverIdentifier: method.receiverIdentifier,
    bankName: method.bankName,
    accountNumber: method.accountNumber,
    accountType: method.accountType,
    accountHolder: method.accountHolder,
    holderIdentification: method.holderIdentification,
  }
}
