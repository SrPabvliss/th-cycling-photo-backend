import { LocationValidator } from '@locations/application/services'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { CustomerProfilePayload } from '@users/domain/payloads'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { UpdateMyProfileCommand } from './update-my-profile.command'
import type { UpdateMyProfileDto } from './update-my-profile.dto'

const MIN_BIRTH_YEAR = 1900

@CommandHandler(UpdateMyProfileCommand)
export class UpdateMyProfileHandler implements ICommandHandler<UpdateMyProfileCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
    private readonly locationValidator: LocationValidator,
  ) {}

  async execute(command: UpdateMyProfileCommand): Promise<EntityIdProjection> {
    const detail = await this.readRepo.getUserDetail(command.userId)
    if (!detail) throw AppException.notFound('entities.user', command.userId)

    const profile = await this.buildProfile(command.userId, command.data)

    await this.writeRepo.updateProfile(command.userId, {
      firstName: command.data.firstName,
      lastName: command.data.lastName,
      profile,
    })

    return { id: command.userId }
  }

  private async buildProfile(
    userId: string,
    data: UpdateMyProfileDto,
  ): Promise<CustomerProfilePayload | null> {
    const hasProfileField =
      data.countryId !== undefined ||
      data.provinceId !== undefined ||
      data.cantonId !== undefined ||
      data.birthDate !== undefined ||
      data.gender !== undefined

    if (!hasProfileField) return null

    const birthDate = this.parseBirthDate(data.birthDate)

    const hasLocationField =
      data.countryId !== undefined || data.provinceId !== undefined || data.cantonId !== undefined

    if (hasLocationField) {
      const stored = await this.readRepo.getMyProfile(userId)

      const countryId = data.countryId ?? stored?.countryId ?? undefined
      const provinceId =
        data.provinceId !== undefined ? data.provinceId : (stored?.provinceId ?? null)
      const cantonId = data.cantonId !== undefined ? data.cantonId : (stored?.cantonId ?? null)

      if (countryId !== undefined) {
        await this.locationValidator.validateFull(countryId, provinceId, cantonId)
      }
    }

    return {
      countryId: data.countryId,
      provinceId: data.provinceId,
      cantonId: data.cantonId,
      birthDate,
      gender: data.gender,
    }
  }

  private parseBirthDate(birthDate: string | null | undefined): Date | null | undefined {
    if (birthDate === undefined) return undefined
    if (birthDate === null) return null

    const parsed = new Date(birthDate)
    const now = new Date()
    if (parsed > now || parsed.getUTCFullYear() < MIN_BIRTH_YEAR) {
      throw AppException.businessRule('user.invalid_birth_date')
    }

    const [year, month, day] = birthDate.split('T')[0].split('-').map(Number)
    const roundTrips =
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() + 1 === month &&
      parsed.getUTCDate() === day
    if (!roundTrips) {
      throw AppException.businessRule('user.invalid_birth_date')
    }

    return parsed
  }
}
