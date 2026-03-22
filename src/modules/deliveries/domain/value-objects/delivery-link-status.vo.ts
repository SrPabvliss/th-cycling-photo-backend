export const DeliveryLinkStatus = {
  ACTIVE: 'active',
  DOWNLOADED: 'downloaded',
  EXPIRED: 'expired',
} as const

export type DeliveryLinkStatusType = (typeof DeliveryLinkStatus)[keyof typeof DeliveryLinkStatus]
