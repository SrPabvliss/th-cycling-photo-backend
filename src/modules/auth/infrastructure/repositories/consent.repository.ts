import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { ConsentType } from '../../domain/constants/consent.constants'
import type { RecordConsentPayload } from '../../domain/payloads'
import type { IConsentRepository } from '../../domain/ports'

@Injectable()
export class ConsentRepository implements IConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(payload: RecordConsentPayload): Promise<void> {
    await this.prisma.userConsent.upsert({
      where: {
        user_id_type_policy_version: {
          user_id: payload.userId,
          type: payload.type,
          policy_version: payload.policyVersion,
        },
      },
      create: {
        user_id: payload.userId,
        type: payload.type,
        policy_version: payload.policyVersion,
        ip: payload.ipAddress ?? null,
        user_agent: payload.userAgent ?? null,
      },
      update: {},
    })
  }

  async findAcceptedTypes(userId: string, policyVersion: string): Promise<ConsentType[]> {
    const rows = await this.prisma.userConsent.findMany({
      where: { user_id: userId, policy_version: policyVersion },
      select: { type: true },
    })

    return rows.map((row) => row.type as ConsentType)
  }
}
