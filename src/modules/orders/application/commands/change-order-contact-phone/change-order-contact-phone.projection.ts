export class OrderContactPhoneChangedProjection {
  /** Order UUID */
  id: string
  /** The phone the order is now reached at */
  phoneNumber: string
  /** Orders whose phone changed: this one and the buyer's others still in progress */
  updatedOrders: number
  /** Whether the buyer's account took the number as its primary one */
  accountUpdated: boolean
}
