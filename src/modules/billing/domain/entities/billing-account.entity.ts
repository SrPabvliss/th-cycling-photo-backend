import { AppException } from '@shared/domain'
import { BillingIdType, type BillingIdTypeValue } from '../value-objects/billing-id-type.vo'

const ID_NUMBER_PATTERNS: Record<BillingIdTypeValue, RegExp> = {
  [BillingIdType.NATIONAL_ID]: /^\d{10}$/,
  [BillingIdType.RUC]: /^\d{13}$/,
  [BillingIdType.PASSPORT]: /^[A-Z0-9]{1,20}$/,
}

const MAX_TEXT_LENGTH = 300
const LINE_BREAK = /[\r\n]/

export class BillingAccount {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly idType: BillingIdTypeValue,
    public readonly idNumber: string,
    public readonly legalName: string,
    public readonly email: string,
    public readonly address: string | null,
    public isDefault: boolean,
    public readonly createdAt: Date,
    public deletedAt: Date | null,
  ) {}

  static create(data: {
    userId: string
    idType: BillingIdTypeValue
    idNumber: string
    legalName: string
    email: string
    address: string | null
    isDefault: boolean
  }): BillingAccount {
    return new BillingAccount(
      crypto.randomUUID(),
      data.userId,
      data.idType,
      BillingAccount.normalizeIdNumber(data.idType, data.idNumber),
      BillingAccount.normalizeLegalName(data.legalName),
      data.email.trim().toLowerCase(),
      BillingAccount.normalizeAddress(data.address),
      data.isDefault,
      new Date(),
      null,
    )
  }

  static fromPersistence(data: {
    id: string
    userId: string
    idType: BillingIdTypeValue
    idNumber: string
    legalName: string
    email: string
    address: string | null
    isDefault: boolean
    createdAt: Date
    deletedAt: Date | null
  }): BillingAccount {
    return new BillingAccount(
      data.id,
      data.userId,
      data.idType,
      data.idNumber,
      data.legalName,
      data.email,
      data.address,
      data.isDefault,
      data.createdAt,
      data.deletedAt,
    )
  }

  markDeleted(): void {
    this.deletedAt = new Date()
    this.isDefault = false
  }

  private static normalizeIdNumber(idType: BillingIdTypeValue, raw: string): string {
    const value =
      idType === BillingIdType.PASSPORT ? raw.replace(/[\s-]/g, '').toUpperCase() : raw.trim()
    if (!ID_NUMBER_PATTERNS[idType].test(value)) {
      throw AppException.businessRule('billing.identification_malformed')
    }
    return value
  }

  private static normalizeLegalName(raw: string): string {
    const value = raw.trim()
    if (value.length === 0 || value.length > MAX_TEXT_LENGTH || LINE_BREAK.test(value)) {
      throw AppException.businessRule('billing.legal_name_invalid')
    }
    return value
  }

  private static normalizeAddress(raw: string | null): string | null {
    const value = raw?.trim() ?? ''
    if (value.length === 0) return null
    if (value.length > MAX_TEXT_LENGTH || LINE_BREAK.test(value)) {
      throw AppException.businessRule('billing.address_invalid')
    }
    return value
  }
}
