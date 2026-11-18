import type { OrderContactService } from '@shared/order-contact'
import { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository, IUserPhoneWriteRepository } from '@users/domain/ports'
import { AddUserPhoneCommand } from './add-user-phone.command'
import { AddUserPhoneHandler } from './add-user-phone.handler'

describe('AddUserPhoneHandler', () => {
  const USER_ID = 'user-id'
  const NUMBER = '+593984198991'

  let readRepo: jest.Mocked<IUserPhoneReadRepository>
  let writeRepo: jest.Mocked<IUserPhoneWriteRepository>
  let orderContact: { syncOrdersInProgress: jest.Mock }
  let handler: AddUserPhoneHandler

  const buildStored = () =>
    UserPhone.fromPersistence({
      id: 'phone-id',
      userId: USER_ID,
      phoneNumber: NUMBER,
      label: null,
      isWhatsapp: false,
      isPrimary: false,
      createdAt: new Date(),
    })

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      getByUserId: jest.fn(),
      countByUserId: jest.fn().mockResolvedValue(1),
      findByUserIdAndNumber: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<IUserPhoneReadRepository>

    writeRepo = {
      save: jest.fn().mockImplementation((phone: UserPhone) => Promise.resolve(phone)),
      delete: jest.fn(),
      setPrimary: jest.fn(),
    } as unknown as jest.Mocked<IUserPhoneWriteRepository>

    orderContact = { syncOrdersInProgress: jest.fn().mockResolvedValue(2) }

    handler = new AddUserPhoneHandler(
      readRepo,
      writeRepo,
      orderContact as unknown as OrderContactService,
    )
  })

  it('rejects a number the same user already registered', async () => {
    readRepo.findByUserIdAndNumber.mockResolvedValue(buildStored())

    await expect(handler.execute(new AddUserPhoneCommand(USER_ID, NUMBER))).rejects.toThrow()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('accepts a number only another user holds', async () => {
    readRepo.findByUserIdAndNumber.mockResolvedValue(null)

    await handler.execute(new AddUserPhoneCommand(USER_ID, NUMBER))

    expect(readRepo.findByUserIdAndNumber).toHaveBeenCalledWith(USER_ID, NUMBER)
    expect(writeRepo.save).toHaveBeenCalled()
  })

  it('marks the first number as primary', async () => {
    readRepo.countByUserId.mockResolvedValue(0)

    await handler.execute(new AddUserPhoneCommand(USER_ID, NUMBER))

    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isPrimary: true }))
  })

  it('gives the first number of an account to its orders in progress', async () => {
    readRepo.countByUserId.mockResolvedValue(0)

    const result = await handler.execute(new AddUserPhoneCommand(USER_ID, NUMBER))

    expect(orderContact.syncOrdersInProgress).toHaveBeenCalledWith(USER_ID, NUMBER, {
      changedById: USER_ID,
      source: 'customer',
    })
    expect(result.syncedOrders).toBe(2)
  })

  it('leaves the orders alone when the new number is an extra one', async () => {
    const result = await handler.execute(new AddUserPhoneCommand(USER_ID, NUMBER))

    expect(orderContact.syncOrdersInProgress).not.toHaveBeenCalled()
    expect(result.syncedOrders).toBe(0)
  })
})
