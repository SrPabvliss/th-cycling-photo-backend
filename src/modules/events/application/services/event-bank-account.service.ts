import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  type IEventPayoutMethodRepository,
  type IEventReadRepository,
} from '@events/domain/ports'
import { Inject, Injectable } from '@nestjs/common'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '@tenants/domain/ports/tenant-payout-method-repository.port'
import { PayoutProvider } from '@tenants/domain/value-objects/payout-provider.vo'

export interface EventBankAccount {
  bankName: string | null
  accountType: string | null
  accountNumber: string | null
  accountHolder: string | null
  holderIdentification: string | null
}

type BankCandidate = EventBankAccount & { provider: string; isActive: boolean }

function firstActiveBank(methods: readonly BankCandidate[]): EventBankAccount | null {
  const bank = methods.find(
    (method) => method.provider === PayoutProvider.BANK_TRANSFER && method.isActive,
  )
  if (!bank) return null

  return {
    bankName: bank.bankName,
    accountType: bank.accountType,
    accountNumber: bank.accountNumber,
    accountHolder: bank.accountHolder,
    holderIdentification: bank.holderIdentification,
  }
}

/**
 * Events created before payout methods were copied onto the event carry no frozen account, and
 * every message built from `findByEventId` alone came out telling the buyer nothing. The tenant
 * account is the same one those events were sold under, so it is the correct fallback — and it is
 * the last one: inventing an account sends a buyer's money to the wrong person.
 */
@Injectable()
export class EventBankAccountService {
  constructor(
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly eventPayoutRepo: IEventPayoutMethodRepository,
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly tenantPayoutRepo: ITenantPayoutMethodRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventRepo: IEventReadRepository,
  ) {}

  async resolveForEvent(eventId: string): Promise<EventBankAccount | null> {
    const frozen = firstActiveBank(await this.eventPayoutRepo.findByEventId(eventId))
    if (frozen) return frozen

    const event = await this.eventRepo.findById(eventId, true)
    if (!event) return null

    return firstActiveBank(await this.tenantPayoutRepo.findByTenantId(event.tenantId))
  }
}
