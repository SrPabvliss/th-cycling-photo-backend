export class OrderPaymentConfirmedProjection {
  /** Order UUID */
  orderId: string
  /** Full delivery URL for sharing */
  deliveryUrl: string
  eventName: string
  token: string
  /** Pre-filled WhatsApp message template for delivery */
  whatsappTemplate: string
}
