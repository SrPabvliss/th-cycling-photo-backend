import { BillingAccount } from '@billing/domain/entities/billing-account.entity'
import { BillingIdType } from '@billing/domain/value-objects/billing-id-type.vo'
import { AppException } from '@shared/domain'
import {
  type BillingAccountChanges,
  UpdateBillingAccountCommand,
} from './update-billing-account.command'
import { UpdateBillingAccountHandler } from './update-billing-account.handler'

describe('UpdateBillingAccountHandler', () => {
  const stored = (overrides: { isDefault?: boolean; address?: string | null } = {}) =>
    BillingAccount.fromPersistence({
      id: 'a-1',
      userId: 'user-1',
      idType: BillingIdType.NATIONAL_ID,
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      email: 'juan@correo.com',
      address: overrides.address === undefined ? 'Av. Amazonas N24-03' : overrides.address,
      isDefault: overrides.isDefault ?? true,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      deletedAt: null,
    })

  const setup = (options: {
    account?: BillingAccount | null
    check?: { valid: boolean; reason: string | null } | null
  }) => {
    const billingAccountRepository = {
      findActiveById: jest
        .fn()
        .mockResolvedValue(options.account === undefined ? stored() : options.account),
      save: jest.fn().mockResolvedValue(undefined),
    }
    const rikuchiyClient = {
      validateIdentification: jest
        .fn()
        .mockResolvedValue(
          options.check === undefined ? { valid: true, reason: null } : options.check,
        ),
    }
    const handler = new UpdateBillingAccountHandler(
      billingAccountRepository as never,
      rikuchiyClient as never,
    )
    return { handler, billingAccountRepository, rikuchiyClient }
  }

  const command = (changes: BillingAccountChanges) =>
    new UpdateBillingAccountCommand('user-1', 'a-1', changes)

  const savedAccount = (repository: { save: jest.Mock }) =>
    repository.save.mock.calls[0][0] as BillingAccount

  const errorOf = async (action: Promise<unknown>) => {
    try {
      await action
    } catch (error) {
      return error as AppException
    }
    throw new Error('expected the handler to throw')
  }

  it('edits the name and email, keeping the id and the default flag', async () => {
    const { handler, billingAccountRepository } = setup({})

    const result = await handler.execute(
      command({ legalName: '  Juan P. Pérez ', email: 'JP@Correo.com' }),
    )

    const saved = savedAccount(billingAccountRepository)
    expect(result).toEqual({ id: 'a-1' })
    expect(saved.id).toBe('a-1')
    expect(saved.isDefault).toBe(true)
    expect(saved.legalName).toBe('Juan P. Pérez')
    expect(saved.email).toBe('jp@correo.com')
    expect(saved.idNumber).toBe('1710034065')
    expect(saved.address).toBe('Av. Amazonas N24-03')
  })

  it('looks the account up by id and owner, so a foreign account is never found', async () => {
    const { handler, billingAccountRepository } = setup({})

    await handler.execute(command({ legalName: 'Otro Nombre' }))

    expect(billingAccountRepository.findActiveById).toHaveBeenCalledWith('a-1', 'user-1')
  })

  it('answers 404 when the account is missing, deleted or belongs to someone else', async () => {
    const { handler, billingAccountRepository, rikuchiyClient } = setup({ account: null })

    const error = await errorOf(handler.execute(command({ legalName: 'Otro Nombre' })))

    expect(error).toBeInstanceOf(AppException)
    expect(error.httpStatus).toBe(404)
    expect(billingAccountRepository.save).not.toHaveBeenCalled()
    expect(rikuchiyClient.validateIdentification).not.toHaveBeenCalled()
  })

  it('does not call the external validation when the identification stays the same', async () => {
    const { handler, rikuchiyClient } = setup({})

    await handler.execute(command({ legalName: 'Otro Nombre', address: 'Calle 1' }))

    expect(rikuchiyClient.validateIdentification).not.toHaveBeenCalled()
  })

  it('does not call the external validation when the same identification is sent again', async () => {
    const { handler, rikuchiyClient } = setup({})

    await handler.execute(command({ idType: BillingIdType.NATIONAL_ID, idNumber: ' 1710034065 ' }))

    expect(rikuchiyClient.validateIdentification).not.toHaveBeenCalled()
  })

  it('validates a changed identification and stores it', async () => {
    const { handler, billingAccountRepository, rikuchiyClient } = setup({})

    await handler.execute(command({ idType: BillingIdType.RUC, idNumber: '1790012345001' }))

    expect(rikuchiyClient.validateIdentification).toHaveBeenCalledWith('04', '1790012345001')
    const saved = savedAccount(billingAccountRepository)
    expect(saved.idType).toBe(BillingIdType.RUC)
    expect(saved.idNumber).toBe('1790012345001')
  })

  it('refuses an identification the external validation rejects, saving nothing', async () => {
    const { handler, billingAccountRepository } = setup({
      check: { valid: false, reason: 'check_digit' },
    })

    const error = await errorOf(
      handler.execute(command({ idType: BillingIdType.RUC, idNumber: '1790012345001' })),
    )

    expect(error.messageKey).toBe('billing.identification_invalid')
    expect(error.httpStatus).toBe(422)
    expect(billingAccountRepository.save).not.toHaveBeenCalled()
  })

  it('lets the change through when the external validation gives no answer and the number checks out locally', async () => {
    const { handler, billingAccountRepository } = setup({ check: null })

    await handler.execute(command({ idType: BillingIdType.RUC, idNumber: '1790016919001' }))

    expect(savedAccount(billingAccountRepository).idNumber).toBe('1790016919001')
  })

  it('refuses a cédula with a wrong check digit when the external validation gives no answer', async () => {
    const { handler, billingAccountRepository } = setup({ check: null })

    const error = await errorOf(
      handler.execute(command({ idType: BillingIdType.NATIONAL_ID, idNumber: '1700000002' })),
    )

    expect(error.messageKey).toBe('billing.identification_invalid')
    expect(billingAccountRepository.save).not.toHaveBeenCalled()
  })

  it('refuses a malformed identification before asking anyone', async () => {
    const { handler, billingAccountRepository, rikuchiyClient } = setup({})

    const error = await errorOf(
      handler.execute(command({ idType: BillingIdType.RUC, idNumber: '123' })),
    )

    expect(error.messageKey).toBe('billing.identification_malformed')
    expect(rikuchiyClient.validateIdentification).not.toHaveBeenCalled()
    expect(billingAccountRepository.save).not.toHaveBeenCalled()
  })

  it('clears the address when it is sent as null', async () => {
    const { handler, billingAccountRepository } = setup({})

    await handler.execute(command({ address: null }))

    expect(savedAccount(billingAccountRepository).address).toBeNull()
  })

  it('leaves the address alone when it is not sent', async () => {
    const { handler, billingAccountRepository } = setup({})

    await handler.execute(command({ email: 'nuevo@correo.com' }))

    expect(savedAccount(billingAccountRepository).address).toBe('Av. Amazonas N24-03')
  })

  it('accepts an empty change set as a no-op that still answers the account id', async () => {
    const { handler, billingAccountRepository, rikuchiyClient } = setup({})

    const result = await handler.execute(command({}))

    expect(result).toEqual({ id: 'a-1' })
    expect(rikuchiyClient.validateIdentification).not.toHaveBeenCalled()
    const saved = savedAccount(billingAccountRepository)
    expect(saved.legalName).toBe('Juan Pérez')
    expect(saved.idNumber).toBe('1710034065')
  })

  it('still answers 404 to an empty change set on a missing account', async () => {
    const { handler } = setup({ account: null })

    const error = await errorOf(handler.execute(command({})))

    expect(error.httpStatus).toBe(404)
  })
})
