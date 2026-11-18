export class UserPhoneSavedProjection {
  /** Phone UUID */
  id: string
  /**
   * Orders in progress that took the new primary number as their contact phone. 0 when the primary
   * number did not change or there was no such order.
   */
  syncedOrders: number
}
