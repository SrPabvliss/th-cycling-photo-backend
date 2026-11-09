export class ActiveDeliveryProjection {
  orderId: string
  eventName: string
  token: string
}

export type ActiveDeliveryRaw = {
  orderId: string
  eventName: string
  token: string
}
