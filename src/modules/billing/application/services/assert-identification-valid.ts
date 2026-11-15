import {
  checkCedula,
  checkRuc,
  type EcuadorianIdVerdict,
} from '@billing/domain/services/ecuadorian-id'
import {
  BillingIdType,
  type BillingIdTypeValue,
} from '@billing/domain/value-objects/billing-id-type.vo'
import { AppException } from '@shared/domain'
import type { IRikuchiyClient } from '@shared/rikuchiy/domain/ports'
import { SRI_ID_TYPE } from '@shared/rikuchiy/domain/rikuchiy-emission-payload'

const refuse = (reason: string | null) =>
  AppException.businessRule('billing.identification_invalid', false, { reason })

function rejectionOf(verdict: EcuadorianIdVerdict): string | null {
  return verdict.valid ? null : verdict.reason
}

/**
 * Refuses an identification the invoice would be rejected for. The checks that are exact run
 * locally first, so a wrong cédula is refused whether or not rikuchiy (the SRI) answers. The SRI
 * then has the last word; when it cannot be asked, a company RUC's module-11 digit is checked
 * locally too. Every place a buyer's identification is written goes through here.
 */
export async function assertIdentificationValid(
  rikuchiy: IRikuchiyClient,
  idType: BillingIdTypeValue,
  idNumber: string,
): Promise<void> {
  const local =
    idType === BillingIdType.NATIONAL_ID
      ? rejectionOf(checkCedula(idNumber))
      : idType === BillingIdType.RUC
        ? rejectionOf(checkRuc(idNumber, { enforceCompanyCheckDigit: false }))
        : null
  if (local) throw refuse(local)

  const check = await rikuchiy.validateIdentification(SRI_ID_TYPE[idType], idNumber)
  if (check && !check.valid) throw refuse(check.reason)

  if (!check && idType === BillingIdType.RUC) {
    const strict = rejectionOf(checkRuc(idNumber, { enforceCompanyCheckDigit: true }))
    if (strict) throw refuse(strict)
  }
}
