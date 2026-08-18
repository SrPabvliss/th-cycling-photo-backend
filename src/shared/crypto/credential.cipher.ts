import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

@Injectable()
export class CredentialCipher {
  private readonly key: Buffer

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('crypto.credentialKey'), 'hex')
    if (this.key.length !== KEY_BYTES) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters')
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`
  }

  decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(':')
    if (!ivHex || !tagHex || !dataHex) throw AppException.internal('Malformed encrypted credential')

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
      'utf8',
    )
  }
}
