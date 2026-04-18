import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { UserPhone } from '@users/domain/entities'
import type { IUserPhoneWriteRepository } from '@users/domain/ports'
import * as UserPhoneMapper from '../mappers/user-phone.mapper'

@Injectable()
export class UserPhoneWriteRepository implements IUserPhoneWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(phone: UserPhone): Promise<UserPhone> {
    const data = UserPhoneMapper.toPersistence(phone)

    const saved = await this.prisma.userPhone.upsert({
      where: { id: phone.id },
      create: data,
      update: data,
    })

    return UserPhoneMapper.toEntity(saved)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userPhone.delete({ where: { id } })
  }

  async setPrimary(userId: string, phoneId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userPhone.updateMany({
        where: { user_id: userId, is_primary: true },
        data: { is_primary: false },
      }),
      this.prisma.userPhone.update({
        where: { id: phoneId },
        data: { is_primary: true },
      }),
    ])
  }
}
