import type {
  OrderCancelledByBuyerPayload,
  OrderCreatedPayload,
  OrderDeliveredPayload,
  OrderPaidPayload,
  OrderRetouchCompletedPayload,
  PaymentNeedsRefundPayload,
  PreviewViewedPayload,
  TenantContractAcceptedPayload,
} from '@notifications/application/services/notification-events'
import { NotificationEvent } from '@notifications/application/services/notification-events'

type TemplateConfig = {
  title: string
  message: (payload: unknown) => string
}

const REFUND_REASON_TEXT: Record<PaymentNeedsRefundPayload['reason'], string> = {
  order_paid: 'ya estaba pagado',
  order_cancelled: 'estaba cancelado',
  order_gifted: 'era un regalo',
}

export const NOTIFICATION_TEMPLATES: Record<string, TemplateConfig> = {
  [NotificationEvent.PREVIEW_VIEWED]: {
    title: 'Preview visualizado',
    message: (p) => {
      const payload = p as PreviewViewedPayload
      return `Alguien vio las fotos de ${payload.eventName}`
    },
  },
  [NotificationEvent.ORDER_CREATED]: {
    title: 'Nuevo pedido',
    message: (p) => {
      const payload = p as OrderCreatedPayload
      return `${payload.customerName} seleccionó ${payload.photoCount} fotos de ${payload.eventName}`
    },
  },
  [NotificationEvent.ORDER_PAID]: {
    title: 'Pago confirmado',
    message: (p) => {
      const payload = p as OrderPaidPayload
      return `Pago confirmado: ${payload.photoCount} fotos de ${payload.customerName} listas para retoque (${payload.eventName})`
    },
  },
  [NotificationEvent.ORDER_DELIVERED]: {
    title: 'Fotos entregadas',
    message: (p) => {
      const payload = p as OrderDeliveredPayload
      return `Fotos entregadas a ${payload.customerName} (${payload.eventName})`
    },
  },
  [NotificationEvent.ORDER_RETOUCH_COMPLETED]: {
    title: 'Retoque completado',
    message: (p) => {
      const payload = p as OrderRetouchCompletedPayload
      return `Todas las ${payload.photoCount} fotos del pedido de ${payload.customerName} (${payload.eventName}) están retocadas`
    },
  },
  [NotificationEvent.ORDER_CANCELLED_BY_BUYER]: {
    title: 'Pedido cancelado por el comprador',
    message: (p) => {
      const payload = p as OrderCancelledByBuyerPayload
      const orderRef = payload.orderId.slice(0, 8).toUpperCase()
      const amount = payload.subtotal !== null ? ` ($${payload.subtotal.toFixed(2)})` : ''
      return `${payload.customerName} canceló el pedido ${orderRef}${amount} de ${payload.eventName} después de recibir los datos de pago. Si llega su transferencia, devuélvela.`
    },
  },
  [NotificationEvent.PAYMENT_NEEDS_REFUND]: {
    title: 'Cobro con tarjeta para reembolsar',
    message: (p) => {
      const payload = p as PaymentNeedsRefundPayload
      const amount = (payload.amountCents / 100).toFixed(2)
      const orderRef = payload.orderId.slice(0, 8).toUpperCase()
      return `Payphone cobró $${amount} con tarjeta (${payload.clientTransactionId}) para el pedido ${orderRef}, que ${REFUND_REASON_TEXT[payload.reason]}. Reembolsa ese cobro al comprador.`
    },
  },
  [NotificationEvent.TENANT_CONTRACT_ACCEPTED]: {
    title: 'Contrato aceptado',
    message: (p) => {
      const payload = p as TenantContractAcceptedPayload
      return `${payload.commercialName} aceptó el contrato de organizador`
    },
  },
}
