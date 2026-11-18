import type { OrderContactService } from '@shared/order-contact'
import { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { UpdateUserPhoneCommand } from './update-user-phone.command'
import { UpdateUserPhoneHandler } from './update-user-phone.handler'

describe('UpdateUserPhoneHandler', () => {
  const USER_ID = 'user-id'
  const PHONE_ID = 'phone-id'
  const NUMBER = '+593984198991'
  const OTHER_NUMBER = '+593984198992'

  let readRepo: jest.Mocked<IUserPhoneReadRepository>
  let writeRepo: jest.Mocked<IUserPhoneWriteRepository>
  let orderContact: { syncOrdersInProgress: jest.Mock }
  let handler: UpdateUserPhoneHandler

  const buildPhone = (id: string, phoneNumber: string, isPrimary = false) =>
    UserPhone.fromPersistence({
      id,
      userId: USER_ID,
      phoneNumber,
      label: null,
      isWhatsapp: false,
      isPrimary,
      createdAt: new Date(),
    })

  beforeEach(() => {
    readRepo = {
      findById: jest.fn().mockResolvedValue(buildPhone(PHONE_ID, NUMBER)),
      getByUserId: jest.fn(),
      countByUserId: jest.fn(),
      findByUserIdAndNumber: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<IUserPhoneReadRepository>

    writeRepo = {
      save: jest.fn().mockImplementation((phone: UserPhone) => Promise.resolve(phone)),
      delete: jest.fn(),
      setPrimary: jest.fn(),
    } as unknown as jest.Mocked<IUserPhoneWriteRepository>

    orderContact = { syncOrdersInProgress: jest.fn().mockResolvedValue(1) }

    handler = new UpdateUserPhoneHandler(
      readRepo,
      writeRepo,
      orderContact as unknown as OrderContactService,
    )
  })

  it('rejects a number the same user already registered on another phone', async () => {
    readRepo.findByUserIdAndNumber.mockResolvedValue(buildPhone('other-phone-id', OTHER_NUMBER))

    await expect(
      handler.execute(new UpdateUserPhoneCommand(USER_ID, PHONE_ID, OTHER_NUMBER)),
    ).rejects.toThrow()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('lets the phone keep its own number while other fields change', async () => {
    await handler.execute(new UpdateUserPhoneCommand(USER_ID, PHONE_ID, NUMBER, 'Personal', true))

    expect(readRepo.findByUserIdAndNumber).not.toHaveBeenCalled()
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Personal', isWhatsapp: true }),
    )
  })

  it('rejects a phone belonging to another user', async () => {
    readRepo.findById.mockResolvedValue(
      UserPhone.fromPersistence({
        id: PHONE_ID,
        userId: 'someone-else',
        phoneNumber: NUMBER,
        label: null,
        isWhatsapp: false,
        isPrimary: false,
        createdAt: new Date(),
      }),
    )

    await expect(
      handler.execute(new UpdateUserPhoneCommand(USER_ID, PHONE_ID, OTHER_NUMBER)),
    ).rejects.toThrow()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('gives a corrected primary number to the orders in progress', async () => {
    readRepo.findById.mockResolvedValue(buildPhone(PHONE_ID, NUMBER, true))

    const result = await handler.execute(
      new UpdateUserPhoneCommand(USER_ID, PHONE_ID, OTHER_NUMBER),
    )

    expect(orderContact.syncOrdersInProgress).toHaveBeenCalledWith(USER_ID, OTHER_NUMBER, {
      changedById: USER_ID,
      source: 'customer',
    })
    expect(result).toEqual({ id: PHONE_ID, syncedOrders: 1 })
  })

  it('leaves the orders alone when the number that changed is not the primary one', async () => {
    const result = await handler.execute(
      new UpdateUserPhoneCommand(USER_ID, PHONE_ID, OTHER_NUMBER),
    )

    expect(orderContact.syncOrdersInProgress).not.toHaveBeenCalled()
    expect(result.syncedOrders).toBe(0)
  })

  it('leaves the orders alone when only the label of the primary number changes', async () => {
    readRepo.findById.mockResolvedValue(buildPhone(PHONE_ID, NUMBER, true))

    await handler.execute(new UpdateUserPhoneCommand(USER_ID, PHONE_ID, NUMBER, 'Personal'))

    expect(orderContact.syncOrdersInProgress).not.toHaveBeenCalled()
  })
})
