import { LocationValidator } from '@locations/application/services'
import type { MyProfileProjection, UserDetailProjection } from '@users/application/projections'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { UpdateMyProfileCommand } from './update-my-profile.command'
import { UpdateMyProfileHandler } from './update-my-profile.handler'

describe('UpdateMyProfileHandler', () => {
  const USER_ID = 'user-id'

  const buildCustomer = (): UserDetailProjection => ({
    id: USER_ID,
    email: 'pablo@test.com',
    firstName: 'Pablo',
    lastName: 'Villacres',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=pablo%40test.com',
    isActive: true,
    roles: ['customer'],
    createdAt: new Date(),
    lastLoginAt: null,
  })

  const buildAdmin = (): UserDetailProjection => ({
    id: USER_ID,
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=admin%40test.com',
    isActive: true,
    roles: ['admin'],
    createdAt: new Date(),
    lastLoginAt: null,
  })

  const buildStoredProfile = (
    countryId: number | null,
    provinceId: number | null = null,
    cantonId: number | null = null,
  ): MyProfileProjection => ({
    id: USER_ID,
    email: 'pablo@test.com',
    firstName: 'Pablo',
    lastName: 'Villacres',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=pablo%40test.com',
    countryId,
    provinceId,
    cantonId,
    birthDate: null,
    gender: null,
    phones: [],
  })

  let handler: UpdateMyProfileHandler
  let readRepo: jest.Mocked<IUserReadRepository>
  let writeRepo: jest.Mocked<IUserWriteRepository>
  let locationValidator: jest.Mocked<LocationValidator>

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
      findActiveAdminIds: jest.fn(),
      getBuyersList: jest.fn(),
      getMyProfile: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    writeRepo = {
      save: jest.fn(),
      updateProfile: jest.fn(),
    } as jest.Mocked<IUserWriteRepository>

    locationValidator = {
      validate: jest.fn(),
      validateFull: jest.fn(),
    } as unknown as jest.Mocked<LocationValidator>

    handler = new UpdateMyProfileHandler(readRepo, writeRepo, locationValidator)
  })

  it('rejects a birth date in the future', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await expect(
      handler.execute(new UpdateMyProfileCommand(USER_ID, { birthDate: '2999-01-01' })),
    ).rejects.toThrow()
    expect(writeRepo.updateProfile).not.toHaveBeenCalled()
  })

  it('rejects a birth date before 1900', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await expect(
      handler.execute(new UpdateMyProfileCommand(USER_ID, { birthDate: '1899-12-31' })),
    ).rejects.toThrow()
    expect(writeRepo.updateProfile).not.toHaveBeenCalled()
  })

  it('rejects a calendar-impossible birth date', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await expect(
      handler.execute(new UpdateMyProfileCommand(USER_ID, { birthDate: '1998-02-31' })),
    ).rejects.toThrow()
    expect(writeRepo.updateProfile).not.toHaveBeenCalled()
  })

  it('accepts a valid calendar birth date', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { birthDate: '1998-02-28' }))

    expect(writeRepo.updateProfile).toHaveBeenCalled()
  })

  it('validates the country, province and canton hierarchy', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await handler.execute(
      new UpdateMyProfileCommand(USER_ID, { countryId: 63, provinceId: 18, cantonId: 180150 }),
    )

    expect(locationValidator.validateFull).toHaveBeenCalledWith(63, 18, 180150)
  })

  it('updates only the names for a user without the customer role', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildAdmin())

    await handler.execute(
      new UpdateMyProfileCommand(USER_ID, { firstName: 'Pablo', countryId: 63 }),
    )

    expect(writeRepo.updateProfile).toHaveBeenCalledWith(USER_ID, {
      firstName: 'Pablo',
      lastName: undefined,
      profile: null,
    })
    expect(locationValidator.validateFull).not.toHaveBeenCalled()
  })

  it('throws when the user does not exist', async () => {
    readRepo.getUserDetail.mockResolvedValue(null)

    await expect(
      handler.execute(new UpdateMyProfileCommand(USER_ID, { firstName: 'Pablo' })),
    ).rejects.toThrow()
    expect(writeRepo.updateProfile).not.toHaveBeenCalled()
  })

  it('validates the province against the stored country when countryId is omitted', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(63))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { provinceId: 18 }))

    expect(readRepo.getMyProfile).toHaveBeenCalledWith(USER_ID)
    expect(locationValidator.validateFull).toHaveBeenCalledWith(63, 18, null)
  })

  it('validates the canton and province against the stored country when countryId is omitted', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(63))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { cantonId: 180150, provinceId: 18 }))

    expect(locationValidator.validateFull).toHaveBeenCalledWith(63, 18, 180150)
  })

  it('skips validation when neither the payload nor the stored profile has a country', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(null))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { provinceId: 18 }))

    expect(locationValidator.validateFull).not.toHaveBeenCalled()
    expect(writeRepo.updateProfile).toHaveBeenCalled()
  })

  it('does not look up the stored profile when the payload has no location fields', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { firstName: 'Pablo' }))

    expect(readRepo.getMyProfile).not.toHaveBeenCalled()
    expect(locationValidator.validateFull).not.toHaveBeenCalled()
  })

  it('validates a changed country against the stored province and canton', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(63, 18, 180150))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { countryId: 76 }))

    expect(locationValidator.validateFull).toHaveBeenCalledWith(76, 18, 180150)
  })

  it('validates the stored country and a changed province against the stored canton', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(63, 18, 180150))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { provinceId: 5 }))

    expect(locationValidator.validateFull).toHaveBeenCalledWith(63, 5, 180150)
  })

  it('validates with a null province instead of falling back to the stored one', async () => {
    readRepo.getUserDetail.mockResolvedValue(buildCustomer())
    readRepo.getMyProfile.mockResolvedValue(buildStoredProfile(63, 18, 180150))

    await handler.execute(new UpdateMyProfileCommand(USER_ID, { provinceId: null }))

    expect(locationValidator.validateFull).toHaveBeenCalledWith(63, null, 180150)
  })
})
