import { createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { IUnsubscribeTokenService } from '../../domain/community'

const DOMAIN = 'community-unsubscribe:'
const SIGNATURE_BYTES = 16

/**
 * Unsubscribe links must work without a session and never expire, so the token is the user id plus
 * a truncated HMAC of it. The key is derived from the JWT secret with its own domain prefix.
 */
@Injectable()
export class UnsubscribeTokenService implements IUnsubscribeTokenService {
  private readonly secret: string

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('jwt.secret')
  }

  sign(userId: string): string {
    return `${Buffer.from(userId).toString('base64url')}.${this.signature(userId).toString('base64url')}`
  }

  verify(token: string): string | null {
    const [encodedId, encodedSignature, extra] = token.split('.')
    if (!encodedId || !encodedSignature || extra !== undefined) return null
    const userId = Buffer.from(encodedId, 'base64url').toString('utf8')
    const given = Buffer.from(encodedSignature, 'base64url')
    const expected = this.signature(userId)
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    return userId
  }

  private signature(userId: string): Buffer {
    return createHmac('sha256', this.secret)
      .update(DOMAIN + userId)
      .digest()
      .subarray(0, SIGNATURE_BYTES)
  }
}
