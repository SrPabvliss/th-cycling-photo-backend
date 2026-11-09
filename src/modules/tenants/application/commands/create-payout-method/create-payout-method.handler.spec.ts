import type { PaymentGatewayRegistry } from '@shared/payment-gateways'
import type { IUserReadRepository } from '@users/domain/ports'
import { TenantPayoutMethod } from '../../../domain/entities/tenant-payout-method.entity'
import type { ITenantPayoutMethodRepository } from '../../../domain/ports/tenant-payout-method-repository.port'
import { PayoutProvider } from '../../../domain/value-objects/payout-provider.vo'
import { CreatePayoutMethodCommand } from './create-payout-method.command'
import { CreatePayoutMethodHandler } from './create-payout-method.handler'

describe('CreatePayoutMethodHandler', () => {
  const USER_ID = 'user-id'
  const TENANT_ID = 'tenant-id'
  const PHONE = '0984198999'

  const BANK = {
    bankName: 'BANCO PICHINCHA',
    accountType: 'ahorros',
    accountNumber: '123142321',
    accountHolder: 'PABLO VILLACRES',
    holderIdentification: '1850046317',
  }

  let repo: jest.Mocked<ITenantPayoutMethodRepository>
  let userRepo: jest.Mocked<IUserReadRepository>
  let registry: jest.Mocked<PaymentGatewayRegistry>
  let handler: CreatePayoutMethodHandler

  const buildPayphone = () => {
    const method = TenantPayoutMethod.createPayphoneSplit(TENANT_ID, '984198999', USER_ID)
    method.markVerified()
    return method
  }

  const buildBank = () =>
    TenantPayoutMethod.createBankTransfer(
      TENANT_ID,
      BANK as unknown as Parameters<typeof TenantPayoutMethod.createBankTransfer>[1],
      USER_ID,
    )

  beforeEach(() => {
    repo = {
      findByTenantId: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ITenantPayoutMethodRepository>

    userRepo = {
      findTenantId: jest.fn().mockResolvedValue(TENANT_ID),
    } as unknown as jest.Mocked<IUserReadRepository>

    registry = {
      get: jest.fn().mockReturnValue({
        verifyReceiver: jest.fn().mockResolvedValue(true),
        platformCredentials: jest.fn().mockReturnValue({}),
      }),
    } as unknown as jest.Mocked<PaymentGatewayRegistry>

    handler = new CreatePayoutMethodHandler(repo, userRepo, registry)
  })

  it('rejects a second active Payphone account', async () => {
    repo.findByTenantId.mockResolvedValue([buildPayphone()])

    await expect(
      handler.execute(new CreatePayoutMethodCommand(USER_ID, PayoutProvider.PAYPHONE, PHONE, null)),
    ).rejects.toThrow()
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('rejects a second active bank account', async () => {
    repo.findByTenantId.mockResolvedValue([buildBank()])

    await expect(
      handler.execute(
        new CreatePayoutMethodCommand(
          USER_ID,
          PayoutProvider.BANK_TRANSFER,
          null,
          BANK as unknown as Parameters<typeof TenantPayoutMethod.createBankTransfer>[1],
        ),
      ),
    ).rejects.toThrow()
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('allows a bank account when only Payphone exists', async () => {
    repo.findByTenantId.mockResolvedValue([buildPayphone()])

    await handler.execute(
      new CreatePayoutMethodCommand(
        USER_ID,
        PayoutProvider.BANK_TRANSFER,
        null,
        BANK as unknown as Parameters<typeof TenantPayoutMethod.createBankTransfer>[1],
      ),
    )

    expect(repo.save).toHaveBeenCalled()
  })

  it('allows the first Payphone account', async () => {
    await handler.execute(
      new CreatePayoutMethodCommand(USER_ID, PayoutProvider.PAYPHONE, PHONE, null),
    )

    expect(repo.save).toHaveBeenCalled()
  })
})
