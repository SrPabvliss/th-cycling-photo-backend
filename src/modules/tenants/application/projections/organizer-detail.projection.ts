import type { OrganizerState } from '../../domain/organizer-state'

export class OrganizerContractProjection {
  id: string
  eventsTotal: number
  eventsUsed: number
  photosPerEvent: number | null
  isValid: boolean
  isRevoked: boolean
  lostSlots: number
  validUntil: string
  acceptedAt: Date | null
  termsVersion: string
  issuedByName: string | null
  issuedAt: Date
  isBackfill: boolean
}

export class OrganizerPayoutProjection {
  id: string
  provider: string
  isActive: boolean
  bankName: string | null
  accountNumber: string | null
  accountType: string | null
  accountHolder: string | null
  holderIdentification: string | null
  receiverIdentifier: string | null
  verifiedAt: Date | null
}

export class OrganizerDetailProjection {
  id: string
  name: string
  publicName: string | null
  watermarkUrl: string | null
  whatsappNumber: string | null
  whatsappVerified: boolean
  holderName: string
  holderEmail: string
  holderEmailVerified: boolean
  accountCount: number
  createdAt: Date
  state: OrganizerState
  available: number
  totalCapacity: number
  usedCapacity: number
  validContractCount: number
  nextExpiry: string | null
  lostSlots: number
  photosPerEventInUse: number | null
  photoLimitsDiffer: boolean
  eventCount: number
  lastEventAt: Date | null
  defaultEventPhotoQuota: number | null
  contracts: OrganizerContractProjection[]
  payouts: OrganizerPayoutProjection[]
}
