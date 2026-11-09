export class MyOrdersSpentProjection {
  /** Currency code (e.g. USD) */
  currency: string
  /** Total spent in that currency (Decimal serialized as string) */
  amount: string
}

export class MyOrdersSummaryProjection {
  /** Orders the customer has, excluding drafts and cancelled ones */
  orderCount: number
  /** Photos the customer owns, from ready and gifted orders */
  photoCount: number
  /** Distinct events the customer has bought from, excluding drafts and cancelled */
  eventCount: number
  /** Money actually spent, per currency. Gifted orders never contribute. */
  spent: MyOrdersSpentProjection[]
}
