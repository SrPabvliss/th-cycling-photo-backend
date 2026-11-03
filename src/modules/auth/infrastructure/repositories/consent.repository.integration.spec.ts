import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { CONSENT_TYPE, POLICY_VERSIONS } from '../../domain/constants/consent.constants'
import { ConsentRepository } from './consent.repository'

describe('consent repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: ConsentRepository
  const userIds: string[] = []

  const newUser = async () => {
    const user = await prisma.user.create({
      data: { email: `consent-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    userIds.push(user.id)
    return user.id
  }

  const accept = (userId: string, ipAddress: string) =>
    repository.record({
      userId,
      type: CONSENT_TYPE.ELECTRONIC_INVOICE,
      policyVersion: POLICY_VERSIONS[CONSENT_TYPE.ELECTRONIC_INVOICE],
      ipAddress,
      userAgent: 'jest',
    })

  const revoke = (userId: string) =>
    prisma.userConsent.updateMany({
      where: { user_id: userId, type: CONSENT_TYPE.ELECTRONIC_INVOICE },
      data: { revoked_at: new Date() },
    })

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService, ConsentRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(ConsentRepository)
  })

  afterAll(async () => {
    await prisma.userConsent.deleteMany({ where: { user_id: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await module.close()
  })

  it('finds the active electronic invoice consent with its ip', async () => {
    const userId = await newUser()
    await accept(userId, '190.1.1.1')

    const active = await repository.findActive(userId, CONSENT_TYPE.ELECTRONIC_INVOICE)

    expect(active?.ip).toBe('190.1.1.1')
    expect(active?.acceptedAt).toBeInstanceOf(Date)
  })

  it('treats a revoked consent as absent', async () => {
    const userId = await newUser()
    await accept(userId, '190.1.1.1')
    await revoke(userId)

    expect(await repository.findActive(userId, CONSENT_TYPE.ELECTRONIC_INVOICE)).toBeNull()
    expect(
      await repository.findAcceptedTypes(userId, POLICY_VERSIONS[CONSENT_TYPE.ELECTRONIC_INVOICE]),
    ).not.toContain(CONSENT_TYPE.ELECTRONIC_INVOICE)
  })

  it('reactivates a revoked consent when it is given again', async () => {
    const userId = await newUser()
    await accept(userId, '190.1.1.1')
    await revoke(userId)
    const before = new Date()

    await accept(userId, '190.2.2.2')

    const active = await repository.findActive(userId, CONSENT_TYPE.ELECTRONIC_INVOICE)
    expect(active?.ip).toBe('190.2.2.2')
    expect(active?.acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('finds nothing for a user who never consented', async () => {
    const userId = await newUser()

    expect(await repository.findActive(userId, CONSENT_TYPE.ELECTRONIC_INVOICE)).toBeNull()
  })
})
