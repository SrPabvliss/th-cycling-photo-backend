import { AppException } from '@shared/domain'

export class UserPhone {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public phoneNumber: string,
    public label: string | null,
    public isWhatsapp: boolean,
    public isPrimary: boolean,
    public readonly createdAt: Date,
  ) {}

  static create(data: {
    userId: string
    phoneNumber: string
    label?: string | null
    isWhatsapp?: boolean
  }): UserPhone {
    UserPhone.validatePhoneNumber(data.phoneNumber)
    if (data.label !== undefined && data.label !== null) {
      UserPhone.validateLabel(data.label)
    }

    return new UserPhone(
      crypto.randomUUID(),
      data.userId,
      data.phoneNumber,
      data.label ?? null,
      data.isWhatsapp ?? false,
      false,
      new Date(),
    )
  }

  update(data: { phoneNumber?: string; label?: string | null; isWhatsapp?: boolean }): void {
    if (data.phoneNumber !== undefined) {
      UserPhone.validatePhoneNumber(data.phoneNumber)
      this.phoneNumber = data.phoneNumber
    }
    if (data.label !== undefined) {
      if (data.label !== null) UserPhone.validateLabel(data.label)
      this.label = data.label
    }
    if (data.isWhatsapp !== undefined) {
      this.isWhatsapp = data.isWhatsapp
    }
  }

  private static validatePhoneNumber(phoneNumber: string): void {
    if (phoneNumber.length < 7 || phoneNumber.length > 20) {
      throw AppException.businessRule('user_phone.phone_number_invalid_length')
    }
  }

  private static validateLabel(label: string): void {
    if (label.length < 1 || label.length > 50) {
      throw AppException.businessRule('user_phone.label_invalid_length')
    }
  }

  static fromPersistence(data: {
    id: string
    userId: string
    phoneNumber: string
    label: string | null
    isWhatsapp: boolean
    isPrimary: boolean
    createdAt: Date
  }): UserPhone {
    return new UserPhone(
      data.id,
      data.userId,
      data.phoneNumber,
      data.label,
      data.isWhatsapp,
      data.isPrimary,
      data.createdAt,
    )
  }
}
