import * as crypto from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { ITokenHashService } from '../../domain/ports/token-hash.service.port'

@Injectable()
export class TokenHashService implements ITokenHashService {
  hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex')
  }

  generateToken(): string {
    return crypto.randomUUID()
  }
}
