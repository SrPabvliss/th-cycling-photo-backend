import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { User } from '@users/domain/entities'
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
        where: { name: roleName as 'admin' | 'classifier' },
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
}
