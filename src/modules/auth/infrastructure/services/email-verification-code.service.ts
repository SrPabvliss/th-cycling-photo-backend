import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  GeneratedEmailVerificationCode,
  IEmailVerificationCodeService,
} from '../../domain/ports'

const CODE_DIGITS = 6
const CODE_UPPER_BOUND = 10 ** CODE_DIGITS

@Injectable()
export class EmailVerificationCodeService implements IEmailVerificationCodeService {
  private readonly hmacSecret: string

  constructor(config: ConfigService) {
    this.hmacSecret = config.getOrThrow<string>('passwordReset.hmacSecret')
  }

  generate(): GeneratedEmailVerificationCode {
    const code = randomInt(0, CODE_UPPER_BOUND).toString().padStart(CODE_DIGITS, '0')

    return { code, hash: this.hash(code) }
  }

  matches(code: string, hash: string): boolean {
    const computed = Buffer.from(this.hash(code), 'hex')
    const stored = Buffer.from(hash, 'hex')

    if (computed.length !== stored.length) return false

    return timingSafeEqual(computed, stored)
  }

  private hash(code: string): string {
    return createHmac('sha256', this.hmacSecret).update(code).digest('hex')
  }
}
