import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { SellerPaymentAccount } from '@payments/domain/entities'
import {
  type ISellerPaymentAccountReadRepository,
  type ISellerPaymentAccountWriteRepository,
  SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY,
  SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY,
} from '@payments/domain/ports'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import type { EntityIdProjection } from '@shared/application'
import { CredentialCipher } from '@shared/crypto'
import { AppException } from '@shared/domain'
import {
  normalizeEcuadorPhone,
  PAYMENT_GATEWAY_REGISTRY,
  PAYPHONE_PROVIDER,
  type PaymentGatewayRegistry,
} from '@shared/payment-gateways'
import { ConfigurePaymentAccountCommand } from './configure-payment-account.command'

@CommandHandler(ConfigurePaymentAccountCommand)
export class ConfigurePaymentAccountHandler
  implements ICommandHandler<ConfigurePaymentAccountCommand>
{
  constructor(
    @Inject(SELLER_PAYMENT_ACCOUNT_READ_REPOSITORY)
    private readonly readRepo: ISellerPaymentAccountReadRepository,
    @Inject(SELLER_PAYMENT_ACCOUNT_WRITE_REPOSITORY)
    private readonly writeRepo: ISellerPaymentAccountWriteRepository,
    @Inject(PAYMENT_GATEWAY_REGISTRY)
    private readonly registry: PaymentGatewayRegistry,
    private readonly cipher: CredentialCipher,
  ) {}

  async execute(command: ConfigurePaymentAccountCommand): Promise<EntityIdProjection> {
    const account =
      command.mode === PaymentMode.SPLIT_RECEIVER
        ? await this.configureSplit(command)
        : await this.configureMerchant(command)

    account.markVerified()
    const saved = await this.writeRepo.save(account)

    return { id: saved.id }
  }

  private async configureSplit(
    command: ConfigurePaymentAccountCommand,
  ): Promise<SellerPaymentAccount> {
    if (!command.phone) throw AppException.businessRule('payment.invalid_phone')

    const gateway = this.registry.get(PAYPHONE_PROVIDER)
    const registered = await gateway.verifyReceiver(command.phone, gateway.platformCredentials())
    if (!registered) throw AppException.businessRule('payment.phone_not_registered')

    const canonicalPhone = normalizeEcuadorPhone(command.phone)

    const existing = await this.readRepo.findByUserId(command.userId)
    if (existing) {
      existing.updateSplitReceiver(canonicalPhone)
      return existing
    }

    return SellerPaymentAccount.createForSplit(command.userId, PAYPHONE_PROVIDER, canonicalPhone)
  }

  private async configureMerchant(
    command: ConfigurePaymentAccountCommand,
  ): Promise<SellerPaymentAccount> {
    if (!command.token) throw AppException.businessRule('payment.invalid_credentials')

    const encrypted = this.cipher.encrypt(
      JSON.stringify({ token: command.token, storeId: command.storeId }),
    )
    const existing = await this.readRepo.findByUserId(command.userId)
    if (existing) {
      existing.updateMerchantCredentials(encrypted)
      return existing
    }

    return SellerPaymentAccount.createForOwnMerchant(command.userId, PAYPHONE_PROVIDER, encrypted)
  }
}
