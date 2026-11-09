import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import {
  AUTH_USER_REPOSITORY,
  CONSENT_REPOSITORY,
  type IAuthUserRepository,
  type IConsentRepository,
} from '@auth/domain/ports'
import { BILLING_ACCOUNT_REPOSITORY, type IBillingAccountRepository } from '@billing/domain/ports'
import { Inject, Injectable } from '@nestjs/common'
import type { OrderSnapData } from '@orders/domain/ports'
import { AppException } from '@shared/domain'

/** Who is buying, as snapshotted on the order: profile, billing account and invoice consent. */
export interface BuyerPurchaseSnapshot {
  customerName: string
  snap: OrderSnapData
}

/**
 * Collects everything an order needs from its buyer to be invoiced once paid, with the same rules
 * for every purchase path (cart checkout, preview link): a profile with a country, an active billing
 * account of their own, and an active electronic-invoice consent.
 */
@Injectable()
export class BuyerPurchaseSnapshotService {
  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(BILLING_ACCOUNT_REPOSITORY)
    private readonly billingAccountRepository: IBillingAccountRepository,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepository: IConsentRepository,
  ) {}

  async build(
    userId: string,
    billingAccountId: string,
    snapCategoryName: string | null,
  ): Promise<BuyerPurchaseSnapshot> {
    const profile = await this.authUserRepo.getUserSnapData(userId)
    if (!profile || profile.countryId === null) {
      throw AppException.businessRule('order.customer_profile_required')
    }

    const billingAccount = await this.billingAccountRepository.findActiveById(
      billingAccountId,
      userId,
    )
    if (!billingAccount) throw AppException.businessRule('billing.account_not_found')

    const invoiceConsent = await this.consentRepository.findActive(
      userId,
      CONSENT_TYPE.ELECTRONIC_INVOICE,
    )
    if (!invoiceConsent) throw AppException.businessRule('billing.invoice_consent_required')

    return {
      customerName: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
      snap: {
        snapFirstName: profile.firstName,
        snapLastName: profile.lastName,
        snapEmail: profile.email,
        snapPhone: profile.phone,
        snapCountryId: profile.countryId,
        snapProvinceId: profile.provinceId,
        snapCantonId: profile.cantonId,
        snapCategoryName,
        snapBillingAccountId: billingAccount.id,
        snapBillingIdType: billingAccount.idType,
        snapBillingIdNumber: billingAccount.idNumber,
        snapBillingLegalName: billingAccount.legalName,
        snapBillingEmail: billingAccount.email,
        snapBillingAddress: billingAccount.address,
        snapInvoiceConsentAt: invoiceConsent.acceptedAt,
        snapInvoiceConsentIp: invoiceConsent.ip,
      },
    }
  }
}
