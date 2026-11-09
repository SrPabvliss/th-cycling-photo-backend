import type { InvitationState, OrganizerState } from '../../domain/organizer-state'

export class OrganizerCardProjection {
  kind: 'organizer'
  id: string
  name: string
  holderName: string
  holderEmail: string
  holderEmailVerified: boolean
  state: OrganizerState
  available: number
  totalCapacity: number
  usedCapacity: number
  nextExpiry: string | null
  lastExpiry: string | null
  lostSlots: number
  photosPerEventInUse: number | null
  photoLimitsDiffer: boolean
  createdAt: Date
}

export class InvitationCardProjection {
  kind: 'invitation'
  id: string
  commercialName: string
  holderName: string
  holderEmail: string
  holderEmailVerified: boolean
  state: InvitationState
  eventsTotal: number
  photosPerEvent: number | null
  validUntil: string
  issuedAt: Date
  issuedByName: string | null
  renewalOfOrganizerId: string | null
  renewalOfOrganizerName: string | null
}

export type OrganizerRowProjection = OrganizerCardProjection | InvitationCardProjection
