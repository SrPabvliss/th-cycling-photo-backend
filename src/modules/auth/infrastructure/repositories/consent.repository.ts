import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { type ConsentType, POLICY_VERSIONS } from '../../domain/constants/consent.constants'
import type { RecordConsentPayload } from '../../domain/payloads'
import type { ActiveConsent, IConsentRepository } from '../../domain/ports'

@Injectable()
export class ConsentRepository implements IConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(payload: RecordConsentPayload): Promise<void> {
    const key = {
      user_id: payload.userId,
      type: payload.type,
      policy_version: payload.policyVersion,
    }

    await this.prisma.userConsent.updateMany({
      where: { ...key, revoked_at: { not: null } },
      data: {
        revoked_at: null,
        accepted_at: new Date(),
        ip: payload.ipAddress ?? null,
        user_agent: payload.userAgent ?? null,
      },
    })

    await this.prisma.userConsent.upsert({
      where: { user_id_type_policy_version: key },
      create: {
        ...key,
        ip: payload.ipAddress ?? null,
        user_agent: payload.userAgent ?? null,
      },
      update: {},
    })
  }

  async findAcceptedTypes(userId: string, policyVersion: string): Promise<ConsentType[]> {
    const rows = await this.prisma.userConsent.findMany({
      where: { user_id: userId, policy_version: policyVersion, revoked_at: null },
      select: { type: true },
    })

    return rows.map((row) => row.type as ConsentType)
  }

  async findActive(userId: string, type: ConsentType): Promise<ActiveConsent | null> {
    const row = await this.prisma.userConsent.findFirst({
      where: {
        user_id: userId,
        type,
        policy_version: POLICY_VERSIONS[type],
        revoked_at: null,
      },
      select: { accepted_at: true, ip: true },
    })

    return row ? { acceptedAt: row.accepted_at, ip: row.ip } : null
  }
}
