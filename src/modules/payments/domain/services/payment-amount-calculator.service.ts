import { Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import type { PaymentAmounts } from '@shared/payment-gateways'
import { toCents } from '../value-objects/money-cents.vo'

@Injectable()
export class PaymentAmountCalculator {
  fromSubtotal(subtotalDollars: number, taxRate: number): PaymentAmounts {
    const totalCents = toCents(subtotalDollars)
    if (totalCents === 0) throw AppException.businessRule('payment.negative_amount')

    const baseCents = taxRate > 0 ? Math.round(totalCents / (1 + taxRate)) : 0
    const taxCents = taxRate > 0 ? totalCents - baseCents : 0
    const untaxedCents = totalCents - baseCents - taxCents

    return {
      amountCents: totalCents,
      amountWithoutTaxCents: untaxedCents,
      amountWithTaxCents: baseCents,
      taxCents,
    }
  }
}
