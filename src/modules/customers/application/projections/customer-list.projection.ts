export class CustomerListProjection {
  /** Customer UUID */
  id: string
  /** Customer first name */
  firstName: string
  /** Customer last name */
  lastName: string
  /** WhatsApp number (unique identifier for find-or-create) */
  whatsapp: string
  /** Optional email address */
  email: string | null
  /** When the customer record was created */
  createdAt: Date
  /** Number of orders placed by this customer (computed) */
  orderCount: number
}
