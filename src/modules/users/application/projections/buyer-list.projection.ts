import type { Gender } from '@generated/prisma/client'

export class BuyerListProjection {
  /** User UUID */
  id: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** Email address */
  email: string
  /** Whether the email has been verified */
  emailVerified: boolean
  /** Primary phone number */
  primaryPhone: string | null
  /** Whether the primary phone is WhatsApp */
  isWhatsapp: boolean
  /** Whether the account is active */
  isActive: boolean
  /** Date of the last login */
  lastLoginAt: Date | null
  /** Country name from customer profile */
  countryName: string | null
  /** Province name from customer profile */
  provinceName: string | null
  /** Canton (city) name from customer profile */
  cityName: string | null
  /** Birth date from customer profile */
  birthDate: Date | null
  /** Gender from customer profile */
  gender: Gender | null
  /** Total number of non-draft orders placed */
  orderCount: number
  /** Total amount spent across paid and delivered orders, as a decimal string */
  spent: string
  /** Total number of photos across paid, delivered and gifted orders */
  photoCount: number
  /** Number of distinct events the buyer has ordered from */
  eventCount: number
  /** Names of the most recent events the buyer has ordered from */
  eventNames: string[]
  /** Date of the first non-draft order */
  firstOrderAt: Date | null
  /** Date of the most recent non-draft order */
  lastOrderAt: Date | null
  /** Number of orders still unpaid */
  unpaidCount: number
  /** Account creation date */
  createdAt: Date
}
