import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { UserPhoneProjection } from '@users/application/projections'
import type { UserPhone } from '@users/domain/entities'
import type { IUserPhoneReadRepository } from '@users/domain/ports'
import * as UserPhoneMapper from '../mappers/user-phone.mapper'

@Injectable()
export class UserPhoneReadRepository implements IUserPhoneReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserPhone | null> {
    const record = await this.prisma.userPhone.findFirst({ where: { id } })
    return record ? UserPhoneMapper.toEntity(record) : null
  }

  async getByUserId(userId: string): Promise<UserPhoneProjection[]> {
    const records = await this.prisma.userPhone.findMany({
      where: { user_id: userId },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    })
    return records.map(UserPhoneMapper.toProjection)
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.userPhone.count({ where: { user_id: userId } })
  }
}
