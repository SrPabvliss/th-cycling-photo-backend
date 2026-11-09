export interface GeneratedEmailVerificationCode {
  code: string
  hash: string
}

export interface IEmailVerificationCodeService {
  generate(): GeneratedEmailVerificationCode
  matches(code: string, hash: string): boolean
}

export const EMAIL_VERIFICATION_CODE_SERVICE = Symbol('EMAIL_VERIFICATION_CODE_SERVICE')
