import { Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type {
  AuthUserProjection,
  MeProjection,
  RegisteredUserProjection,
  UserSnapDataProjection,
} from '../../application/projections'
import type { RegisterUserPayload } from '../../domain/payloads'
import type { IAuthUserRepository } from '../../domain/ports'

@Injectable()
export class AuthUserRepository implements IAuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUserProjection | null> {
    const record = await this.prisma.user.findFirst({
      where: { email },
      include: { user_roles: { include: { role: true } } },
    })

    if (!record) return null

    return {
      id: record.id,
      email: record.email,
      passwordHash: record.password_hash,
      isActive: record.is_active,
      role: record.user_roles[0]?.role.name ?? 'operator',
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { last_login_at: new Date() },
    })
  }

  /** Retrieves the authenticated user's profile data. */
  async getMe(userId: string): Promise<MeProjection | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_roles: { include: { role: true } },
        customer_profile: true,
        phones: true,
      },
    })

    if (!user) return null

    const role = user.user_roles[0]?.role.name ?? 'customer'

    const result: MeProjection = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role,
      phones: user.phones.map((p) => ({
        id: p.id,
        phoneNumber: p.phone_number,
        label: p.label,
        isWhatsapp: p.is_whatsapp,
        isPrimary: p.is_primary,
      })),
    }

    if (user.customer_profile) {
      result.profile = {
        countryId: user.customer_profile.country_id,
        provinceId: user.customer_profile.province_id,
        cantonId: user.customer_profile.canton_id,
      }
    }

    return result
  }

  /** Registers a new user with role, profile, and phone in a single transaction. */
  async register(payload: RegisterUserPayload): Promise<RegisteredUserProjection> {
    return this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: payload.email,
          password_hash: payload.passwordHash,
          first_name: payload.firstName,
          last_name: payload.lastName,
          is_active: true,
        },
      })

      const customerRole = await tx.role.findUnique({
        where: { name: 'customer' },
      })
      if (!customerRole) throw AppException.businessRule('auth.role_not_found')

      await tx.userRole.create({
        data: { user_id: createdUser.id, role_id: customerRole.id },
      })

      await tx.customerProfile.create({
        data: {
          user_id: createdUser.id,
          country_id: payload.countryId,
          province_id: payload.provinceId,
          canton_id: payload.cantonId,
        },
      })

      await tx.userPhone.create({
        data: {
          user_id: createdUser.id,
          phone_number: payload.phoneNumber,
          is_whatsapp: true,
          is_primary: true,
        },
      })

      return { id: createdUser.id, email: createdUser.email }
    })
  }

  /** Checks if a user with the given email already exists. */
  async findByEmailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    })
    return user !== null
  }

  /** Returns user snap data for order creation. */
  async getUserSnapData(userId: string): Promise<UserSnapDataProjection | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        first_name: true,
        last_name: true,
        email: true,
        phones: {
          where: { is_primary: true },
          select: { phone_number: true },
          take: 1,
        },
        customer_profile: {
          select: { country_id: true, province_id: true, canton_id: true },
        },
      },
    })

    if (!user) return null

    return {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phones[0]?.phone_number ?? null,
      countryId: user.customer_profile?.country_id ?? null,
      provinceId: user.customer_profile?.province_id ?? null,
      cantonId: user.customer_profile?.canton_id ?? null,
    }
  }
}
