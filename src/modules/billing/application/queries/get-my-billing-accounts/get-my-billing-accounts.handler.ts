import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import { CONSENT_REPOSITORY, type IConsentRepository } from '@auth/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '../../../domain/ports'
import type { MyBillingAccountsProjection } from '../../projections/billing-account.projection'
import { GetMyBillingAccountsQuery } from './get-my-billing-accounts.query'

@QueryHandler(GetMyBillingAccountsQuery)
export class GetMyBillingAccountsHandler implements IQueryHandler<GetMyBillingAccountsQuery> {
  constructor(
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepository: IConsentRepository,
  ) {}

  async execute(query: GetMyBillingAccountsQuery): Promise<MyBillingAccountsProjection> {
    const [accounts, consent] = await Promise.all([
      this.billingAccountRepository.findActiveByUser(query.userId),
      this.consentRepository.findActive(query.userId, CONSENT_TYPE.ELECTRONIC_INVOICE),
    ])

    return {
      accounts: accounts.map((account) => ({
        id: account.id,
        idType: account.idType,
        idNumber: account.idNumber,
        legalName: account.legalName,
        email: account.email,
        address: account.address,
        isDefault: account.isDefault,
      })),
      invoiceConsentGiven: consent !== null,
    }
  }
}
