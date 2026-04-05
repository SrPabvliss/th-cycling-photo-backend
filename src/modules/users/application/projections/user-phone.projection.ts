export class UserPhoneProjection {
  /** Phone UUID */
  id: string
  /** Phone number */
  phoneNumber: string
  /** Optional label (e.g. "Personal", "Work") */
  label: string | null
  /** Whether this number has WhatsApp */
  isWhatsapp: boolean
  /** Whether this is the primary phone */
  isPrimary: boolean
}
