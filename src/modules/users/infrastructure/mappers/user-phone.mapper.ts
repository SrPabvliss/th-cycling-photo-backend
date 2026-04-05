import type { Prisma, UserPhone as PrismaUserPhone } from '@generated/prisma/client'
import type { UserPhoneProjection } from '@users/application/projections'
import { UserPhone } from '@users/domain/entities'

export function toPersistence(entity: UserPhone): Prisma.UserPhoneUncheckedCreateInput {
  return {
    id: entity.id,
    user_id: entity.userId,
    phone_number: entity.phoneNumber,
    label: entity.label,
    is_whatsapp: entity.isWhatsapp,
    is_primary: entity.isPrimary,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaUserPhone): UserPhone {
  return UserPhone.fromPersistence({
    id: record.id,
    userId: record.user_id,
    phoneNumber: record.phone_number,
    label: record.label,
    isWhatsapp: record.is_whatsapp,
    isPrimary: record.is_primary,
    createdAt: record.created_at,
  })
}

export function toProjection(record: PrismaUserPhone): UserPhoneProjection {
  return {
    id: record.id,
    phoneNumber: record.phone_number,
    label: record.label,
    isWhatsapp: record.is_whatsapp,
    isPrimary: record.is_primary,
  }
}
