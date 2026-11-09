import { createCipheriv, createDecipheriv } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const ALGORITHM = 'aes-256-cbc'
const KEY_BYTES = 32
const EMPTY_IV = Buffer.alloc(16)

@Injectable()
export class PayphoneTransferToCipher {
  private readonly key: Buffer

  constructor(config: ConfigService) {
    const password = Buffer.from(
      config.getOrThrow<string>('payphone.splitEncryptionPassword'),
      'utf8',
    )
    if (password.length > KEY_BYTES) {
      throw new Error('PAYPHONE_SPLIT_ENCRYPTION_PASSWORD must be at most 32 bytes')
    }

    this.key = Buffer.alloc(KEY_BYTES)
    password.copy(this.key)
  }

  encrypt(plain: string): string {
    const cipher = createCipheriv(ALGORITHM, this.key, EMPTY_IV)
    return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('base64')
  }

  decryptForTesting(payload: string): string {
    const decipher = createDecipheriv(ALGORITHM, this.key, EMPTY_IV)
    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }
}
