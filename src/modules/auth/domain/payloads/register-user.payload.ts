import type { Gender } from '@generated/prisma/client'

export interface RegisterUserPayload {
  email: string
  passwordHash: string
  firstName: string | null
  lastName: string | null
  countryId: number
  provinceId: number | null
  cantonId: number | null
  phoneNumber: string
  birthDate: Date | null
  gender: Gender | null
}
