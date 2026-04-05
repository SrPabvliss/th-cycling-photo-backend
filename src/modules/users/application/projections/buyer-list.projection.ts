export class BuyerListProjection {
  /** User UUID */
  id: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** Email address */
  email: string
  /** Primary phone number */
  primaryPhone: string | null
  /** Whether the primary phone is WhatsApp */
  isWhatsapp: boolean
  /** Country name from customer profile */
  countryName: string | null
  /** Total number of orders placed */
  orderCount: number
  /** Date of the most recent order */
  lastOrderAt: Date | null
  /** Account creation date */
  createdAt: Date
}
