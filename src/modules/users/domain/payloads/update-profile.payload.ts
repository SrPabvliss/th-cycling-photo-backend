import type { Gender } from '@generated/prisma/client'

export interface CustomerProfilePayload {
  countryId?: number
  provinceId?: number | null
  cantonId?: number | null
  birthDate?: Date | null
  gender?: Gender | null
}

export interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
  profile: CustomerProfilePayload | null
}
