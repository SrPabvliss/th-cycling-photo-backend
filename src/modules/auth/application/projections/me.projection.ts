export class MePhoneProjection {
  /** Phone UUID */
  id: string
  /** Phone number */
  phoneNumber: string
  /** Optional label */
  label: string | null
  /** Whether the phone is WhatsApp-enabled */
  isWhatsapp: boolean
  /** Whether the phone is the primary one */
  isPrimary: boolean
}

export class MeProfileProjection {
  /** Country ID */
  countryId: number
  /** Province ID (optional) */
  provinceId: number | null
  /** Canton ID (optional) */
  cantonId: number | null
}

export class MeProjection {
  /** User UUID */
  id: string
  /** User email */
  email: string
  /** First name */
  firstName: string | null
  /** Last name */
  lastName: string | null
  /** User role */
  role: string
  /** Customer profile (only for customer role) */
  profile?: MeProfileProjection
  /** User phones */
  phones: MePhoneProjection[]
}
