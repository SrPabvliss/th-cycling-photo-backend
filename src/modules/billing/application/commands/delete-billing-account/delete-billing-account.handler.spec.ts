import { BillingAccount } from '@billing/domain/entities/billing-account.entity'
import { BillingIdType } from '@billing/domain/value-objects/billing-id-type.vo'
import { AppException } from '@shared/domain'
import { DeleteBillingAccountCommand } from './delete-billing-account.command'
import { DeleteBillingAccountHandler } from './delete-billing-account.handler'

describe('DeleteBillingAccountHandler', () => {
  const account = (id: string, isDefault: boolean) =>
    BillingAccount.fromPersistence({
      id,
      userId: 'user-1',
      idType: BillingIdType.NATIONAL_ID,
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      email: 'juan@correo.com',
      address: null,
      isDefault,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      deletedAt: null,
    })

  const setup = (target: BillingAccount | null, remaining: BillingAccount[]) => {
    const billingAccountRepository = {
      findActiveById: jest.fn().mockResolvedValue(target),
      findActiveByUser: jest.fn().mockResolvedValue(remaining),
      save: jest.fn().mockResolvedValue(undefined),
      makeDefault: jest.fn().mockResolvedValue(undefined),
    }
    const handler = new DeleteBillingAccountHandler(billingAccountRepository as never)
    return { handler, billingAccountRepository }
  }

  it('deletes the account logically', async () => {
    const target = account('a-1', false)
    const { handler, billingAccountRepository } = setup(target, [account('a-2', true)])

    await handler.execute(new DeleteBillingAccountCommand('user-1', 'a-1'))

    const saved = billingAccountRepository.save.mock.calls[0][0] as BillingAccount
    expect(saved.deletedAt).toBeInstanceOf(Date)
    expect(billingAccountRepository.makeDefault).not.toHaveBeenCalled()
  })

  it('promotes the newest remaining account when the default one is deleted', async () => {
    const { handler, billingAccountRepository } = setup(account('a-1', true), [
      account('a-3', false),
      account('a-2', false),
    ])

    await handler.execute(new DeleteBillingAccountCommand('user-1', 'a-1'))

    expect(billingAccountRepository.makeDefault).toHaveBeenCalledWith('user-1', 'a-3')
  })

  it('refuses an account that is not the user active one', async () => {
    const { handler } = setup(null, [])

    const failure = await handler
      .execute(new DeleteBillingAccountCommand('user-1', 'a-9'))
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AppException)
    expect((failure as AppException).httpStatus).toBe(404)
  })
})
