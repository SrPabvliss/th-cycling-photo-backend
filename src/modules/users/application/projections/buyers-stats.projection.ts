export class BuyersStatsProjection {
  /** Number of buyers matching the current filters (including the active purchase tab) */
  totalBuyers: number
  /** Number of those buyers who have placed at least one non-draft order */
  boughtCount: number
  /** Share of totalBuyers who bought, as a whole-number percent (0 when totalBuyers is 0) */
  boughtPercent: number
  /** Number of those buyers with two or more non-draft orders */
  recurrentCount: number
  /** Number of those buyers registered in the last 30 days */
  newLast30Days: number
  /** Average paid+delivered spend per buyer who bought, as a decimal string (e.g. "12.50") */
  averageTicket: string
  /** Row counts for each purchase tab, honouring every filter except purchase itself */
  tabs: {
    all: number
    bought: number
    never: number
    recurrent: number
  }
}
