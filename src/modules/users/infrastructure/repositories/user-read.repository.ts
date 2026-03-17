import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type { UserDetailProjection, UserListProjection } from '@users/application/projections'
import type { User } from '@users/domain/entities'
import type { IUserReadRepository } from '@users/domain/ports'
import * as UserMapper from '../mappers/user.mapper'

const USER_LIST_SELECT = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  phone: true,
  avatar_url: true,
  is_active: true,
  created_at: true,
  user_roles: { include: { role: true } },
} as const

const USER_DETAIL_SELECT = {
  ...USER_LIST_SELECT,
  last_login_at: true,
} as const

@Injectable()
export class UserReadRepository implements IUserReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { id },
      include: { user_roles: { include: { role: true } } },
    })
    return record ? UserMapper.toEntity(record) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { email },
      include: { user_roles: { include: { role: true } } },
    })
    return record ? UserMapper.toEntity(record) : null
  }

  async getUsersList(
    pagination: Pagination,
    includeInactive = false,
  ): Promise<PaginatedResult<UserListProjection>> {
    const where = includeInactive ? {} : { is_active: true }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ])

    return new PaginatedResult(
      users.map((u) => UserMapper.toListProjection(u)),
      total,
      pagination,
    )
  }

  async getUserDetail(id: string): Promise<UserDetailProjection | null> {
    const record = await this.prisma.user.findFirst({
      where: { id },
      select: USER_DETAIL_SELECT,
    })

    return record ? UserMapper.toDetailProjection(record) : null
  }
}
