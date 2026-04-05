import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type {
  BuyerListProjection,
  UserDetailProjection,
  UserListProjection,
} from '@users/application/projections'
import type { User } from '@users/domain/entities'
import type { IUserReadRepository } from '@users/domain/ports'
import * as UserMapper from '../mappers/user.mapper'

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
        select: UserMapper.userListSelectConfig,
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
      select: UserMapper.userDetailSelectConfig,
    })

    return record ? UserMapper.toDetailProjection(record) : null
  }

  /** Returns IDs of all active users with admin role. */
  async findActiveAdminIds(): Promise<string[]> {
    const admins = await this.prisma.userRole.findMany({
      where: {
        role: { name: 'admin' },
        user: { is_active: true },
      },
      select: { user_id: true },
    })
    return admins.map((a) => a.user_id)
  }

  /** Returns a paginated list of customer/buyer users with order stats. */
  async getBuyersList(
    pagination: Pagination,
    search?: string,
  ): Promise<PaginatedResult<BuyerListProjection>> {
    const where: Prisma.UserWhereInput = {
      user_roles: { some: { role: { name: 'customer' } } },
    }

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phones: { some: { phone_number: { contains: search } } } },
      ]
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          created_at: true,
          phones: {
            where: { is_primary: true },
            select: { phone_number: true, is_whatsapp: true },
            take: 1,
          },
          customer_profile: {
            select: { country: { select: { name: true } } },
          },
          _count: { select: { orders_placed: true } },
          orders_placed: {
            select: { created_at: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ])

    const items: BuyerListProjection[] = users.map((u) => ({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      primaryPhone: u.phones[0]?.phone_number ?? null,
      isWhatsapp: u.phones[0]?.is_whatsapp ?? false,
      countryName: u.customer_profile?.country?.name ?? null,
      orderCount: u._count.orders_placed,
      lastOrderAt: u.orders_placed[0]?.created_at ?? null,
      createdAt: u.created_at,
    }))

    return new PaginatedResult(items, total, pagination)
  }
}
