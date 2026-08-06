export interface GeneratedPasswordResetToken {
  id: string
  token: string
  tokenHash: string
}

export interface ParsedPasswordResetToken {
  id: string
  secret: string
}

export interface IPasswordResetTokenService {
  generate(): GeneratedPasswordResetToken
  parse(token: string): ParsedPasswordResetToken | null
  matches(secret: string, storedHash: string): boolean
}

export const PASSWORD_RESET_TOKEN_SERVICE = Symbol('PASSWORD_RESET_TOKEN_SERVICE')
