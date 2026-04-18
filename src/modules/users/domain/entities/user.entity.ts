import { AppException } from '@shared/domain'

export class User {
  constructor(
    public readonly id: string,
    public email: string,
    public passwordHash: string,
    public firstName: string | null,
    public lastName: string | null,
    public avatarUrl: string | null,
    public avatarStorageKey: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public lastLoginAt: Date | null,
  ) {}

  static create(data: {
    email: string
    passwordHash: string
    firstName: string
    lastName: string
  }): User {
    User.validateEmail(data.email)
    User.validateName(data.firstName, 'first_name')
    User.validateName(data.lastName, 'last_name')

    return new User(
      crypto.randomUUID(),
      data.email,
      data.passwordHash,
      data.firstName,
      data.lastName,
      null,
      null,
      true,
      new Date(),
      null,
    )
  }

  update(data: { firstName?: string; lastName?: string }): void {
    if (data.firstName !== undefined) {
      User.validateName(data.firstName, 'first_name')
      this.firstName = data.firstName
    }
    if (data.lastName !== undefined) {
      User.validateName(data.lastName, 'last_name')
      this.lastName = data.lastName
    }
  }

  deactivate(): void {
    if (!this.isActive) {
      throw AppException.businessRule('user.already_deactivated')
    }
    this.isActive = false
  }

  reactivate(): void {
    if (this.isActive) {
      throw AppException.businessRule('user.already_active')
    }
    this.isActive = true
  }

  setPassword(passwordHash: string): void {
    this.passwordHash = passwordHash
  }

  setAvatar(url: string | null, storageKey: string): void {
    this.avatarUrl = url
    this.avatarStorageKey = storageKey
  }

  removeAvatar(): void {
    this.avatarUrl = null
    this.avatarStorageKey = null
  }

  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw AppException.businessRule('user.email_invalid')
    }
  }

  private static validateName(name: string, field: string): void {
    if (name.length < 1 || name.length > 100) {
      throw AppException.businessRule(`user.${field}_invalid_length`)
    }
  }

  static fromPersistence(data: {
    id: string
    email: string
    passwordHash: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
    avatarStorageKey: string | null
    isActive: boolean
    createdAt: Date
    lastLoginAt: Date | null
  }): User {
    return new User(
      data.id,
      data.email,
      data.passwordHash,
      data.firstName,
      data.lastName,
      data.avatarUrl,
      data.avatarStorageKey,
      data.isActive,
      data.createdAt,
      data.lastLoginAt,
    )
  }
}
