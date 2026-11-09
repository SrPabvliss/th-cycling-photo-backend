import type { Gender } from '@generated/prisma/client'
import { UserPhoneProjection } from './user-phone.projection'

export class MyProfileProjection {
  /** User UUID */
  id: string
  /** User email address */
  email: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** Avatar URL (real or DiceBear fallback) */
  avatarUrl: string
  /** Country of the customer profile */
  countryId: number | null
  /** Province of the customer profile */
  provinceId: number | null
  /** Canton of the customer profile */
  cantonId: number | null
  /** Birth date of the customer profile */
  birthDate: Date | null
  /** Gender of the customer profile */
  gender: Gender | null
  /** The user's phone numbers */
  phones: UserPhoneProjection[]
}
