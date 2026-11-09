export interface EventAggregate {
  reviewedCount: number
  categorizedCount: number
  revenue: string
  paidCount: number
  deliveredCount: number
  giftedCount: number
  unpaidCount: number
  cancelledCount: number
  soldPhotoCount: number
  lastUploadAt: Date | null
}
