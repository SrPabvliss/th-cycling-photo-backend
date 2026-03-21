export const PreviewLinkStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
} as const

export type PreviewLinkStatusType = (typeof PreviewLinkStatus)[keyof typeof PreviewLinkStatus]
