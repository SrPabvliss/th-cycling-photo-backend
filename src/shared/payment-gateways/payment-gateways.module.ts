import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PayphoneAdapter, PayphoneHttpClient, PayphoneTransferToCipher } from './adapters/payphone'
import { PAYMENT_GATEWAY_REGISTRY } from './domain/ports'
import { PaymentGatewayRegistry } from './infrastructure/registry/payment-gateway.registry'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PayphoneHttpClient,
    {
      provide: PayphoneTransferToCipher,
      useFactory: (config: ConfigService) =>
        config.get<string>('payphone.splitEncryptionPassword')
          ? new PayphoneTransferToCipher(config)
          : null,
      inject: [ConfigService],
    },
    PayphoneAdapter,
    {
      provide: PAYMENT_GATEWAY_REGISTRY,
      useFactory: (payphone: PayphoneAdapter) => new PaymentGatewayRegistry([payphone]),
      inject: [PayphoneAdapter],
    },
  ],
  exports: [PAYMENT_GATEWAY_REGISTRY],
})
export class PaymentGatewaysModule {}
