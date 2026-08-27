import { OrderStatus, type OrderStatusType } from './value-objects/order-status.vo'

export type OrderActionId =
  | 'notify'
  | 'resend'
  | 'confirm'
  | 'deliver'
  | 'regenerate'
  | 'gift'
  | 'to_sale'
  | 'to_gift'
  | 'cancel'

export type OrderActionKind = 'solid' | 'ghost' | 'danger'

export interface OrderAction {
  id: OrderActionId
  kind: OrderActionKind
}

export interface OrderActionFacts {
  status: OrderStatusType | string
  deliveredAt: Date | null
}

const STATUS_PRIMARY_ACTION: Partial<Record<OrderStatusType | string, OrderActionId>> = {
  [OrderStatus.PENDING]: 'notify',
  [OrderStatus.PAYMENT_INFO_SENT]: 'confirm',
  [OrderStatus.PAID]: 'deliver',
}

function primaryActionId(o: OrderActionFacts): OrderActionId | null {
  if (o.status === OrderStatus.GIFTED) {
    return o.deliveredAt === null ? 'deliver' : null
  }
  return STATUS_PRIMARY_ACTION[o.status] ?? null
}

function baseActionIds(o: OrderActionFacts, isPlatform: boolean): OrderActionId[] {
  const isCancellable =
    o.deliveredAt === null &&
    (o.status === OrderStatus.PENDING ||
      o.status === OrderStatus.PAYMENT_INFO_SENT ||
      o.status === OrderStatus.PAID ||
      o.status === OrderStatus.GIFTED)

  const cancelId: OrderActionId[] = isCancellable ? ['cancel'] : []

  switch (o.status) {
    case OrderStatus.PENDING:
      return ['notify', 'confirm', ...cancelId, ...(isPlatform ? (['gift'] as const) : [])]
    case OrderStatus.PAYMENT_INFO_SENT:
      return ['resend', 'confirm', ...cancelId, ...(isPlatform ? (['gift'] as const) : [])]
    case OrderStatus.PAID:
      return ['deliver', ...cancelId, ...(isPlatform ? (['to_gift'] as const) : [])]
    case OrderStatus.DELIVERED:
      return ['regenerate', ...(isPlatform ? (['to_gift'] as const) : [])]
    case OrderStatus.GIFTED: {
      const mainAction: OrderActionId = o.deliveredAt === null ? 'deliver' : 'regenerate'
      return [mainAction, ...cancelId, ...(isPlatform ? (['to_sale'] as const) : [])]
    }
    default:
      return []
  }
}

export function resolveOrderActions(o: OrderActionFacts, isPlatform: boolean): OrderAction[] {
  const primary = primaryActionId(o)

  return baseActionIds(o, isPlatform).map((id) => ({
    id,
    kind: id === 'cancel' ? 'danger' : id === primary ? 'solid' : 'ghost',
  }))
}

export function primaryOrderAction(o: OrderActionFacts, isPlatform: boolean): OrderAction | null {
  const primary = primaryActionId(o)
  if (primary === null) return null

  return resolveOrderActions(o, isPlatform).find((a) => a.id === primary) ?? null
}
