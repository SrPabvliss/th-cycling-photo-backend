import { CONSENT_TYPE, POLICY_VERSIONS } from '@auth/domain/constants/consent.constants'
import { AppException } from '@shared/domain'

export type ContractStatusValue = 'pending' | 'accepted' | 'revoked' | 'expired'

interface TenantContractState {
  id: string
  userId: string
  tenantId: string | null
  commercialName: string
  eventsTotal: number
  photosPerEvent: number | null
  status: ContractStatusValue
  validUntil: Date
  termsVersion: string
  acceptedAt: Date | null
  revokedAt: Date | null
  issuedById: string | null
}

export class TenantContract {
  private constructor(private state: TenantContractState) {}

  static issue(data: {
    userId: string
    commercialName: string
    eventsTotal: number
    photosPerEvent: number | null
    validUntil: Date
    issuedById: string
  }): TenantContract {
    return new TenantContract({
      id: crypto.randomUUID(),
      userId: data.userId,
      tenantId: null,
      commercialName: data.commercialName,
      eventsTotal: data.eventsTotal,
      photosPerEvent: data.photosPerEvent,
      status: 'pending',
      validUntil: data.validUntil,
      termsVersion: POLICY_VERSIONS[CONSENT_TYPE.TERMS_TENANT],
      acceptedAt: null,
      revokedAt: null,
      issuedById: data.issuedById,
    })
  }

  static rehydrate(
    state: Omit<TenantContractState, 'issuedById'> & { issuedById?: string | null },
  ): TenantContract {
    return new TenantContract({ issuedById: null, ...state })
  }

  get id(): string {
    return this.state.id
  }
  get userId(): string {
    return this.state.userId
  }
  get tenantId(): string | null {
    return this.state.tenantId
  }
  get commercialName(): string {
    return this.state.commercialName
  }
  get eventsTotal(): number {
    return this.state.eventsTotal
  }
  get photosPerEvent(): number | null {
    return this.state.photosPerEvent
  }
  get status(): ContractStatusValue {
    return this.state.status
  }
  get validUntil(): Date {
    return this.state.validUntil
  }
  get termsVersion(): string {
    return this.state.termsVersion
  }
  get acceptedAt(): Date | null {
    return this.state.acceptedAt
  }
  get revokedAt(): Date | null {
    return this.state.revokedAt
  }
  get issuedById(): string | null {
    return this.state.issuedById
  }

  get isUsable(): boolean {
    return this.state.status === 'accepted' && this.state.validUntil > new Date()
  }

  assertAcceptableBy(userId: string, emailVerified: boolean, now: Date): void {
    if (this.state.userId !== userId) throw AppException.businessRule('contract.not_yours')
    if (!emailVerified) throw AppException.businessRule('contract.email_not_verified')
    if (this.state.validUntil <= now || this.state.status === 'expired') {
      throw AppException.businessRule('contract.expired')
    }
    if (this.state.status === 'accepted')
      throw AppException.businessRule('contract.already_accepted')
    if (this.state.status === 'revoked') throw AppException.businessRule('contract.revoked')
  }

  assertRevocable(): void {
    if (this.state.status !== 'pending') throw AppException.businessRule('contract.not_pending')
  }

  assertResendable(now: Date): void {
    this.assertRevocable()
    if (this.state.validUntil <= now) throw AppException.businessRule('contract.resend_lapsed')
  }
}
