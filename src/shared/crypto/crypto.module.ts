import { Global, Module } from '@nestjs/common'
import { CredentialCipher } from './credential.cipher'

@Global()
@Module({
  providers: [CredentialCipher],
  exports: [CredentialCipher],
})
export class CryptoModule {}
