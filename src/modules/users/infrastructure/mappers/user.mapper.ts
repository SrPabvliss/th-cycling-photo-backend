import { Prisma, type User as PrismaUser } from '@generated/prisma/client'
import type { UserDetailProjection, UserListProjection } from '@users/application/projections'
import { User } from '@users/domain/entities'

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/initials/svg'

type UserWithRoles = PrismaUser & {
  user_roles: Array<{ role: { name: string } }>
}

export const userListSelectConfig = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  avatar_url: true,
  is_active: true,
  created_at: true,
  user_roles: { include: { role: true } },
} satisfies Prisma.UserSelect

export type UserListSelect = Prisma.UserGetPayload<{ select: typeof userListSelectConfig }>

export const userDetailSelectConfig = {
  ...userListSelectConfig,
  last_login_at: true,
} satisfies Prisma.UserSelect

export type UserDetailSelect = Prisma.UserGetPayload<{ select: typeof userDetailSelectConfig }>

function getDiceBearUrl(email: string): string {
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(email)}`
}

export function toPersistence(entity: User): Prisma.UserUncheckedCreateInput {
  return {
    id: entity.id,
    email: entity.email,
    password_hash: entity.passwordHash,
    first_name: entity.firstName,
    last_name: entity.lastName,
    avatar_url: entity.avatarUrl,
    avatar_storage_key: entity.avatarStorageKey,
    is_active: entity.isActive,
    created_at: entity.createdAt,
    last_login_at: entity.lastLoginAt,
  }
}

export function toEntity(record: UserWithRoles): User {
  return User.fromPersistence({
    id: record.id,
    email: record.email,
    passwordHash: record.password_hash,
    firstName: record.first_name,
    lastName: record.last_name,
    avatarUrl: record.avatar_url,
    avatarStorageKey: record.avatar_storage_key,
    isActive: record.is_active,
    createdAt: record.created_at,
    lastLoginAt: record.last_login_at,
  })
}

export function toEntityFromRaw(record: PrismaUser): User {
  return User.fromPersistence({
    id: record.id,
    email: record.email,
    passwordHash: record.password_hash,
    firstName: record.first_name,
    lastName: record.last_name,
    avatarUrl: record.avatar_url,
    avatarStorageKey: record.avatar_storage_key,
    isActive: record.is_active,
    createdAt: record.created_at,
    lastLoginAt: record.last_login_at,
  })
}

export function toListProjection(record: UserListSelect): UserListProjection {
  return {
    id: record.id,
    email: record.email,
    firstName: record.first_name,
    lastName: record.last_name,
    avatarUrl: record.avatar_url ?? getDiceBearUrl(record.email),
    isActive: record.is_active,
    roles: record.user_roles.map((ur) => ur.role.name),
    createdAt: record.created_at,
  }
}

export function toDetailProjection(record: UserDetailSelect): UserDetailProjection {
  return {
    id: record.id,
    email: record.email,
    firstName: record.first_name,
    lastName: record.last_name,
    avatarUrl: record.avatar_url ?? getDiceBearUrl(record.email),
    isActive: record.is_active,
    roles: record.user_roles.map((ur) => ur.role.name),
    createdAt: record.created_at,
    lastLoginAt: record.last_login_at,
  }
}
