import type { IUserReadRepository } from '@users/domain/ports'
import type { MyProfileProjection } from '../../projections'
import { GetMyProfileHandler } from './get-my-profile.handler'
import { GetMyProfileQuery } from './get-my-profile.query'

describe('GetMyProfileHandler', () => {
  const USER_ID = 'user-id'
  const PROFILE: MyProfileProjection = {
    id: USER_ID,
    email: 'pablo@test.com',
    firstName: 'Pablo',
    lastName: 'Villacres',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=pablo%40test.com',
    countryId: 1,
    provinceId: 2,
    cantonId: 3,
    birthDate: new Date('1990-01-01'),
    gender: 'male',
    phones: [],
  }

  let handler: GetMyProfileHandler
  let readRepo: jest.Mocked<IUserReadRepository>

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

    handler = new GetMyProfileHandler(readRepo)
  })

  it('returns the profile for the given user', async () => {
    readRepo.getMyProfile.mockResolvedValue(PROFILE)

    await expect(handler.execute(new GetMyProfileQuery(USER_ID))).resolves.toBe(PROFILE)
    expect(readRepo.getMyProfile).toHaveBeenCalledWith(USER_ID)
  })

  it('throws when the user does not exist', async () => {
    readRepo.getMyProfile.mockResolvedValue(null)

    await expect(handler.execute(new GetMyProfileQuery(USER_ID))).rejects.toThrow()
  })
})
