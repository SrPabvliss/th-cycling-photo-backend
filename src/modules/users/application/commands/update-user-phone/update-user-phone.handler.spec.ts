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
  let handler: UpdateUserPhoneHandler

  const buildPhone = (id: string, phoneNumber: string) =>
    UserPhone.fromPersistence({
      id,
      userId: USER_ID,
      phoneNumber,
      label: null,
      isWhatsapp: false,
      isPrimary: false,
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

    handler = new UpdateUserPhoneHandler(readRepo, writeRepo)
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
})
