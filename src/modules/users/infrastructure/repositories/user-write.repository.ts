import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { User } from '@users/domain/entities'
import type { UpdateProfilePayload } from '@users/domain/payloads'
import type { IUserWriteRepository } from '@users/domain/ports'
import * as UserMapper from '../mappers/user.mapper'

@Injectable()
export class UserWriteRepository implements IUserWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User, roleName?: string): Promise<User> {
    const data = UserMapper.toPersistence(user)

    const saved = await this.prisma.user.upsert({
      where: { id: user.id },
      create: data,
      update: data,
      include: { user_roles: { include: { role: true } } },
    })

    if (roleName && saved.user_roles.length === 0) {
      const role = await this.prisma.role.findUnique({
        where: { name: roleName as 'admin' | 'operator' },
      })
      if (role) {
        await this.prisma.userRole.create({
          data: { user_id: saved.id, role_id: role.id },
        })
      }
    }

    const result = await this.prisma.user.findUniqueOrThrow({
      where: { id: saved.id },
      include: { user_roles: { include: { role: true } } },
    })

    return UserMapper.toEntity(result)
  }

  async updateProfile(userId: string, data: UpdateProfilePayload): Promise<void> {
    const userData = Object.fromEntries(
      Object.entries({ first_name: data.firstName, last_name: data.lastName }).filter(
        ([, value]) => value !== undefined,
      ),
    )

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userData })
      }

      if (!data.profile) return

      const existing = await tx.customerProfile.findUnique({ where: { user_id: userId } })
      const { countryId, provinceId, cantonId, birthDate, gender } = data.profile

      if (!existing) {
        if (countryId === undefined) return

        await tx.customerProfile.create({
          data: {
            user_id: userId,
            country_id: countryId,
            province_id: provinceId,
            canton_id: cantonId,
            birth_date: birthDate,
            gender,
          },
        })
        return
      }

      const profileUpdateData = Object.fromEntries(
        Object.entries({
          country_id: countryId,
          province_id: provinceId,
          canton_id: cantonId,
          birth_date: birthDate,
          gender,
        }).filter(([, value]) => value !== undefined),
      )

      await tx.customerProfile.update({
        where: { user_id: userId },
        data: profileUpdateData,
      })
    })
  }
}
