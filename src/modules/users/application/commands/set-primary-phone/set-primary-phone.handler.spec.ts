import type { OrderContactService } from '@shared/order-contact'
import { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { SetPrimaryPhoneCommand } from './set-primary-phone.command'
import { SetPrimaryPhoneHandler } from './set-primary-phone.handler'

describe('SetPrimaryPhoneHandler', () => {
  const USER_ID = 'user-id'
  const PHONE_ID = 'phone-id'
  const NUMBER = '+593984198991'

  const phoneOf = (userId: string) =>
    UserPhone.fromPersistence({
      id: PHONE_ID,
      userId,
      phoneNumber: NUMBER,
      label: null,
      isWhatsapp: true,
      isPrimary: false,
      createdAt: new Date(),
    })

  const setup = (owner = USER_ID) => {
    const readRepo = { findById: jest.fn().mockResolvedValue(phoneOf(owner)) }
    const writeRepo = { setPrimary: jest.fn() }
    const orderContact = { syncOrdersInProgress: jest.fn().mockResolvedValue(3) }
    const handler = new SetPrimaryPhoneHandler(
      readRepo as unknown as IUserPhoneReadRepository,
      writeRepo as unknown as IUserPhoneWriteRepository,
      orderContact as unknown as OrderContactService,
    )
    return { handler, writeRepo, orderContact }
  }

  it('makes the number primary and gives it to the orders in progress', async () => {
    const { handler, writeRepo, orderContact } = setup()

    const result = await handler.execute(new SetPrimaryPhoneCommand(USER_ID, PHONE_ID))

    expect(writeRepo.setPrimary).toHaveBeenCalledWith(USER_ID, PHONE_ID)
    expect(orderContact.syncOrdersInProgress).toHaveBeenCalledWith(USER_ID, NUMBER, {
      changedById: USER_ID,
      source: 'customer',
    })
    expect(result).toEqual({ id: PHONE_ID, syncedOrders: 3 })
  })

  it('touches nothing for a phone of another user', async () => {
    const { handler, writeRepo, orderContact } = setup('someone-else')

    await expect(handler.execute(new SetPrimaryPhoneCommand(USER_ID, PHONE_ID))).rejects.toThrow()
    expect(writeRepo.setPrimary).not.toHaveBeenCalled()
    expect(orderContact.syncOrdersInProgress).not.toHaveBeenCalled()
  })
})
