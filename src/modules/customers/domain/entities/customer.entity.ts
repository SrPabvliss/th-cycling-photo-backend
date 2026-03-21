import { AppException } from '@shared/domain'

export class Customer {
  constructor(
    public readonly id: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly whatsapp: string,
    public readonly email: string | null,
    public readonly createdAt: Date,
  ) {}

  /**
   * Factory method for creating a new customer.
   * Applies all business validations before instantiation.
   */
  static create(data: {
    firstName: string
    lastName: string
    whatsapp: string
    email: string | null
  }): Customer {
    Customer.validateFirstName(data.firstName)
    Customer.validateLastName(data.lastName)
    Customer.validateWhatsApp(data.whatsapp)
    if (data.email) Customer.validateEmail(data.email)

    return new Customer(
      crypto.randomUUID(),
      data.firstName,
      data.lastName,
      data.whatsapp,
      data.email,
      new Date(),
    )
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    firstName: string
    lastName: string
    whatsapp: string
    email: string | null
    createdAt: Date
  }): Customer {
    return new Customer(
      data.id,
      data.firstName,
      data.lastName,
      data.whatsapp,
      data.email,
      data.createdAt,
    )
  }

  private static validateFirstName(name: string): void {
    if (name.length < 1 || name.length > 100) {
      throw AppException.businessRule('customer.first_name_invalid_length')
    }
  }

  private static validateLastName(name: string): void {
    if (name.length < 1 || name.length > 100) {
      throw AppException.businessRule('customer.last_name_invalid_length')
    }
  }

  private static validateWhatsApp(whatsapp: string): void {
    if (!whatsapp.startsWith('+') || whatsapp.length < 8 || whatsapp.length > 20) {
      throw AppException.businessRule('customer.whatsapp_invalid_format')
    }
  }

  private static validateEmail(email: string): void {
    if (!email.includes('@') || email.length > 255) {
      throw AppException.businessRule('customer.email_invalid_format')
    }
  }
}
