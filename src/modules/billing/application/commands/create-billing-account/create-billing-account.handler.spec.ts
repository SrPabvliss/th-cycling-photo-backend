import { BillingAccount } from '@billing/domain/entities/billing-account.entity'
import {
  BillingIdType,
  type BillingIdTypeValue,
} from '@billing/domain/value-objects/billing-id-type.vo'
import { AppException } from '@shared/domain'
import { CreateBillingAccountCommand } from './create-billing-account.command'
import { CreateBillingAccountHandler } from './create-billing-account.handler'

describe('CreateBillingAccountHandler', () => {
  const existing = () =>
    BillingAccount.create({
      userId: 'user-1',
      idType: BillingIdType.NATIONAL_ID,
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      email: 'juan@correo.com',
      address: null,
      isDefault: true,
    })

  const setup = (options: {
    accounts?: BillingAccount[]
    check?: { valid: boolean; reason: string | null } | null
  }) => {
    const billingAccountRepository = {
      findActiveByUser: jest.fn().mockResolvedValue(options.accounts ?? []),
      save: jest.fn().mockResolvedValue(undefined),
    }
    const rikuchiyClient = {
      validateIdentification: jest
        .fn()
        .mockResolvedValue(
          options.check === undefined ? { valid: true, reason: null } : options.check,
        ),
    }
    const handler = new CreateBillingAccountHandler(
      billingAccountRepository as never,
      rikuchiyClient as never,
    )
    return { handler, billingAccountRepository, rikuchiyClient }
  }

  const command = (idType: BillingIdTypeValue = BillingIdType.RUC, idNumber = '1790012345001') =>
    new CreateBillingAccountCommand(
      'user-1',
      idType,
      idNumber,
      'Ciclismo Andes S.A.',
      'a@b.ec',
      null,
    )

  const savedAccount = (repository: { save: jest.Mock }) =>
    repository.save.mock.calls[0][0] as BillingAccount

  it('makes the first account the default one', async () => {
    const { handler, billingAccountRepository } = setup({})

    const result = await handler.execute(command())

    const saved = savedAccount(billingAccountRepository)
    expect(saved.isDefault).toBe(true)
    expect(result).toEqual({ id: saved.id })
  })

  it('does not make a later account the default one', async () => {
    const { handler, billingAccountRepository } = setup({ accounts: [existing()] })

    await handler.execute(command())

    expect(savedAccount(billingAccountRepository).isDefault).toBe(false)
  })

  it('asks rikuchiy with the SRI code of the identification type', async () => {
    const { handler, rikuchiyClient } = setup({})

    await handler.execute(command(BillingIdType.NATIONAL_ID, '1710034065'))

    expect(rikuchiyClient.validateIdentification).toHaveBeenCalledWith('05', '1710034065')
  })

  it('refuses an identification rikuchiy finds invalid', async () => {
    const { handler, billingAccountRepository } = setup({
      check: { valid: false, reason: 'invalid_check_digit' },
    })

    const failure = await handler.execute(command()).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AppException)
    expect((failure as AppException).messageKey).toBe('billing.identification_invalid')
    expect(billingAccountRepository.save).not.toHaveBeenCalled()
  })

  it('saves the account when rikuchiy cannot give a verdict', async () => {
    const { handler, billingAccountRepository } = setup({ check: null })

    await handler.execute(command())

    expect(billingAccountRepository.save).toHaveBeenCalled()
  })
})
