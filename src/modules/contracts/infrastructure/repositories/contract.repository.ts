import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import type { Prisma, TenantContract as TenantContractRow } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { TEMPLATE_KEYS } from '@shared/authorization/domain/permission-template.constants'
import { AppException, EVENT_SLOT_CONSUMED_FILTER, toEcuadorDateOnly } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type { ContractProjection } from '../../application/projections/contract.projection'
import { TenantContract } from '../../domain/entities/tenant-contract.entity'
import type {
  AcceptContractPayload,
  IContractRepository,
} from '../../domain/ports/contract-repository.port'

function toEntity(row: TenantContractRow): TenantContract {
  return TenantContract.rehydrate({
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    commercialName: row.commercial_name,
    eventsTotal: row.events_total,
    photosPerEvent: row.photos_per_event,
    status: row.status,
    validUntil: row.valid_until,
    termsVersion: row.terms_version,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    issuedById: row.issued_by_id,
  })
}

function toProjection(
  row: TenantContractRow & {
    _count: { events: number }
    user: { email: string; first_name: string | null; last_name: string | null }
  },
): ContractProjection {
  return {
    id: row.id,
    commercialName: row.commercial_name,
    eventsTotal: row.events_total,
    eventsUsed: row._count.events,
    photosPerEvent: row.photos_per_event,
    status: row.status,
    validUntil: toEcuadorDateOnly(row.valid_until),
    termsVersion: row.terms_version,
    acceptedAt: row.accepted_at,
    holderEmail: row.user.email,
    holderName: [row.user.first_name, row.user.last_name].filter(Boolean).join(' '),
    isBackfill: row.is_backfill,
  }
}

const WITH_HOLDER_AND_COUNT = {
  include: {
    _count: { select: { events: { where: EVENT_SLOT_CONSUMED_FILTER } } },
    user: { select: { email: true, first_name: true, last_name: true } },
  },
} satisfies Prisma.TenantContractDefaultArgs

@Injectable()
export class ContractRepository implements IContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(tokenHash: string): Promise<TenantContract | null> {
    const row = await this.prisma.tenantContract.findUnique({ where: { token_hash: tokenHash } })
    return row ? toEntity(row) : null
  }

  async findById(id: string): Promise<TenantContract | null> {
    const row = await this.prisma.tenantContract.findUnique({ where: { id } })
    return row ? toEntity(row) : null
  }

  async findPendingByUserId(userId: string): Promise<TenantContract | null> {
    const row = await this.prisma.tenantContract.findFirst({
      where: { user_id: userId, status: 'pending', valid_until: { gt: new Date() } },
    })
    return row ? toEntity(row) : null
  }

  async listAll(): Promise<ContractProjection[]> {
    const rows = await this.prisma.tenantContract.findMany({
      ...WITH_HOLDER_AND_COUNT,
      orderBy: { created_at: 'desc' },
    })
    return rows.map(toProjection)
  }

  async listByUser(userId: string): Promise<ContractProjection[]> {
    const rows = await this.prisma.tenantContract.findMany({
      where: { user_id: userId },
      ...WITH_HOLDER_AND_COUNT,
      orderBy: { created_at: 'desc' },
    })
    return rows.map(toProjection)
  }

  async create(contract: TenantContract, tokenHash: string): Promise<void> {
    await this.prisma.tenantContract.create({
      data: {
        id: contract.id,
        user_id: contract.userId,
        tenant_id: contract.tenantId,
        commercial_name: contract.commercialName,
        events_total: contract.eventsTotal,
        photos_per_event: contract.photosPerEvent,
        status: contract.status,
        token_hash: tokenHash,
        valid_until: contract.validUntil,
        terms_version: contract.termsVersion,
        issued_by_id: contract.issuedById,
      },
    })
  }

  // The status-guarded updateMany is what makes acceptance idempotent: two tabs, a double
  // click, or a retry all race the same `where: { status: 'pending' }`, and only one can win.
  // A read-then-write here would leave a window where both could pass the check.
  async acceptInTransaction(
    data: AcceptContractPayload,
  ): Promise<{ tenantId: string; tenantCreated: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const accepted = await tx.tenantContract.updateMany({
        where: { id: data.contractId, status: 'pending' },
        data: {
          status: 'accepted',
          accepted_at: new Date(),
          accepted_ip: data.ip,
          accepted_user_agent: data.userAgent,
        },
      })
      if (accepted.count === 0) {
        throw AppException.businessRule('contract.already_accepted')
      }

      await tx.userConsent.upsert({
        where: {
          user_id_type_policy_version: {
            user_id: data.userId,
            type: CONSENT_TYPE.TERMS_TENANT,
            policy_version: data.termsVersion,
          },
        },
        create: {
          user_id: data.userId,
          type: CONSENT_TYPE.TERMS_TENANT,
          policy_version: data.termsVersion,
          ip: data.ip,
          user_agent: data.userAgent,
        },
        update: {
          ip: data.ip,
          user_agent: data.userAgent,
        },
      })

      const user = await tx.user.findUniqueOrThrow({
        where: { id: data.userId },
        select: { tenant_id: true },
      })

      if (user.tenant_id) {
        await tx.tenantContract.update({
          where: { id: data.contractId },
          data: { tenant_id: user.tenant_id },
        })
        return { tenantId: user.tenant_id, tenantCreated: false }
      }

      const template = await tx.permissionTemplate.findUnique({
        where: { key: TEMPLATE_KEYS.TENANT },
      })
      if (!template) {
        throw new Error(`Permission template '${TEMPLATE_KEYS.TENANT}' not found.`)
      }

      const tenant = await tx.tenant.create({
        data: { name: data.commercialName, event_quota: 0, is_platform: false },
      })

      // Turning on the tenant hat is always this shape: tenant_id, the tenant template, and
      // a bump of permissions_version — the same three writes every other grant of a user's
      // permission-affecting fields makes.
      await tx.user.update({
        where: { id: data.userId },
        data: {
          tenant_id: tenant.id,
          permission_template_id: template.id,
          permissions_version: { increment: 1 },
        },
      })

      await tx.tenantContract.update({
        where: { id: data.contractId },
        data: { tenant_id: tenant.id },
      })

      return { tenantId: tenant.id, tenantCreated: true }
    })
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.tenantContract.update({
      where: { id },
      data: { status: 'revoked', revoked_at: new Date() },
    })
  }

  async rotateToken(id: string, tokenHash: string): Promise<void> {
    await this.prisma.tenantContract.update({
      where: { id },
      data: { token_hash: tokenHash },
    })
  }

  // Runs inside the caller's transaction on purpose: SELECT ... FOR UPDATE takes a row lock on
  // every candidate contract before counting, so a second concurrent event creation for the
  // same tenant blocks on that lock and only re-reads (with the first creation's slot already
  // taken) once the first transaction commits. Neither can see the last slot free twice.
  async consumeSlot(
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<TenantContract | null> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenant_contracts
      WHERE tenant_id = ${tenantId} AND status = 'accepted' AND valid_until > now()
      ORDER BY accepted_at ASC
      FOR UPDATE
    `
    if (locked.length === 0) return null

    const rows = await tx.tenantContract.findMany({
      where: { id: { in: locked.map((row) => row.id) } },
      orderBy: { accepted_at: 'asc' },
      include: { _count: { select: { events: { where: EVENT_SLOT_CONSUMED_FILTER } } } },
    })

    const usable = rows.find((row) => row._count.events < row.events_total)
    return usable ? toEntity(usable) : null
  }

  async findNextUsable(
    tenantId: string,
  ): Promise<{ contract: TenantContract; eventsUsed: number } | null> {
    const rows = await this.prisma.tenantContract.findMany({
      where: { tenant_id: tenantId, status: 'accepted', valid_until: { gt: new Date() } },
      orderBy: { accepted_at: 'asc' },
      include: { _count: { select: { events: { where: EVENT_SLOT_CONSUMED_FILTER } } } },
    })

    const usable = rows.find((row) => row._count.events < row.events_total)
    return usable ? { contract: toEntity(usable), eventsUsed: usable._count.events } : null
  }

  async findMostRecentAccepted(
    tenantId: string,
  ): Promise<{ contract: TenantContract; eventsUsed: number } | null> {
    const row = await this.prisma.tenantContract.findFirst({
      where: { tenant_id: tenantId, status: 'accepted' },
      orderBy: { accepted_at: 'desc' },
      include: { _count: { select: { events: { where: EVENT_SLOT_CONSUMED_FILTER } } } },
    })

    return row ? { contract: toEntity(row), eventsUsed: row._count.events } : null
  }
}
