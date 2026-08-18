import { Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import type { IPaymentGateway } from '../../domain/ports'

@Injectable()
export class PaymentGatewayRegistry {
  private readonly byProvider: Map<string, IPaymentGateway>

  constructor(gateways: IPaymentGateway[]) {
    this.byProvider = new Map(gateways.map((gateway) => [gateway.provider, gateway]))
  }

  get(provider: string): IPaymentGateway {
    const gateway = this.byProvider.get(provider)
    if (!gateway) throw AppException.internal(`No payment gateway registered for ${provider}`)
    return gateway
  }
}
