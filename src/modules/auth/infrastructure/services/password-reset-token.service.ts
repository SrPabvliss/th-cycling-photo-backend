import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  GeneratedPasswordResetToken,
  IPasswordResetTokenService,
  ParsedPasswordResetToken,
} from '../../domain/ports'

const SECRET_BYTES = 32

@Injectable()
export class PasswordResetTokenService implements IPasswordResetTokenService {
  private readonly hmacSecret: string

  constructor(config: ConfigService) {
    this.hmacSecret = config.getOrThrow<string>('passwordReset.hmacSecret')
  }

  generate(): GeneratedPasswordResetToken {
    const id = randomUUID()
    const secret = randomBytes(SECRET_BYTES).toString('base64url')

    return { id, token: `${id}.${secret}`, tokenHash: this.hash(secret) }
  }

  parse(token: string): ParsedPasswordResetToken | null {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [id, secret] = parts
    if (!id || !secret) return null

    return { id, secret }
  }

  matches(secret: string, storedHash: string): boolean {
    const computed = Buffer.from(this.hash(secret), 'hex')
    const stored = Buffer.from(storedHash, 'hex')

    if (computed.length !== stored.length) return false

    return timingSafeEqual(computed, stored)
  }

  private hash(secret: string): string {
    return createHmac('sha256', this.hmacSecret).update(secret).digest('hex')
  }
}
