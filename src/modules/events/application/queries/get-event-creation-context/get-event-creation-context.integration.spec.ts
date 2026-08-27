import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'
import { ContractRepository } from '../../../../contracts/infrastructure/repositories/contract.repository'

describe('get event creation context — findNextUsable', () => {
  let module: TestingModule
  let prisma: PrismaService
  let contractRepo: ContractRepository

  let eventType: { id: number }
  const createdTenantIds: string[] = []
  const createdUserIds: string[] = []
  const createdContractIds: string[] = []
  const createdEventIds: string[] = []

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
      providers: [PrismaService, ContractRepository],
    }).compile()

    prisma = module.get(PrismaService)
    contractRepo = module.get(ContractRepository)
    eventType = await prisma.eventType.findFirstOrThrow()
  })

  afterEach(async () => {
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
    await prisma.tenantContract.deleteMany({ where: { id: { in: createdContractIds } } })
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } })

    const remainingEvents = await prisma.event.findMany({
      where: { id: { in: createdEventIds } },
    })
    const remainingContracts = await prisma.tenantContract.findMany({
      where: { id: { in: createdContractIds } },
    })
    const remainingUsers = await prisma.user.findMany({ where: { id: { in: createdUserIds } } })
    const remainingTenants = await prisma.tenant.findMany({
      where: { id: { in: createdTenantIds } },
    })

    expect(remainingEvents).toHaveLength(0)
    expect(remainingContracts).toHaveLength(0)
    expect(remainingUsers).toHaveLength(0)
    expect(remainingTenants).toHaveLength(0)

    createdEventIds.length = 0
    createdContractIds.length = 0
    createdUserIds.length = 0
    createdTenantIds.length = 0
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  async function createTenant(): Promise<string> {
    const tenant = await prisma.tenant.create({
      data: { name: 'Creation Context Tenant', is_platform: false, event_quota: 0 },
    })
    createdTenantIds.push(tenant.id)
    return tenant.id
  }

  async function createHolder(): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `holder-${crypto.randomUUID()}@t.com`, password_hash: 'x' },
    })
    createdUserIds.push(user.id)
    return user.id
  }

  async function createAcceptedContract(params: {
    tenantId: string
    userId: string
    eventsTotal: number
    acceptedAt: Date
    validUntil?: Date
  }): Promise<string> {
    const contract = await prisma.tenantContract.create({
      data: {
        user_id: params.userId,
        tenant_id: params.tenantId,
        commercial_name: 'Creation Context Contract',
        events_total: params.eventsTotal,
        photos_per_event: 4000,
        status: 'accepted',
        token_hash: crypto.randomUUID(),
        valid_until: params.validUntil ?? new Date('2099-01-01'),
        terms_version: 'v1',
        accepted_at: params.acceptedAt,
      },
    })
    createdContractIds.push(contract.id)
    return contract.id
  }

  async function createConsumedEvent(tenantId: string, contractId: string): Promise<string> {
    const event = await prisma.event.create({
      data: {
        name: 'Creation Context Event',
        slug: `creation-context-event-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenantId,
        contract_id: contractId,
      },
    })
    createdEventIds.push(event.id)
    return event.id
  }

  it('returns the newer contract when the older one is full', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    const older = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-01-01'),
    })
    await createConsumedEvent(tenantId, older)

    const newer = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-02-01'),
    })

    const result = await contractRepo.findNextUsable(tenantId)

    expect(result?.contract.id).toBe(newer)
    expect(result?.eventsUsed).toBe(0)
  })

  it('returns the older contract when it still has room', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    const older = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 2,
      acceptedAt: new Date('2026-01-01'),
    })
    await createConsumedEvent(tenantId, older)

    await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-02-01'),
    })

    const result = await contractRepo.findNextUsable(tenantId)

    expect(result?.contract.id).toBe(older)
    expect(result?.eventsUsed).toBe(1)
  })

  it('returns null when every contract is full', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    const older = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-01-01'),
    })
    await createConsumedEvent(tenantId, older)

    const newer = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-02-01'),
    })
    await createConsumedEvent(tenantId, newer)

    const result = await contractRepo.findNextUsable(tenantId)

    expect(result).toBeNull()
  })

  it('ignores expired contracts even when they have room', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 5,
      acceptedAt: new Date('2020-01-01'),
      validUntil: new Date('2020-06-01'),
    })

    const result = await contractRepo.findNextUsable(tenantId)

    expect(result).toBeNull()
  })

  it('findMostRecentAccepted returns the full contract with hasSlot-relevant counts when it is the only one', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    const full = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 1,
      acceptedAt: new Date('2026-01-01'),
    })
    await createConsumedEvent(tenantId, full)

    const usable = await contractRepo.findNextUsable(tenantId)
    const mostRecent = await contractRepo.findMostRecentAccepted(tenantId)

    expect(usable).toBeNull()
    expect(mostRecent?.contract.id).toBe(full)
    expect(mostRecent?.eventsUsed).toBe(1)
    expect(mostRecent?.contract.eventsTotal).toBe(1)
  })

  it('findMostRecentAccepted returns the expired contract even though findNextUsable ignores it', async () => {
    const tenantId = await createTenant()
    const userId = await createHolder()

    const expired = await createAcceptedContract({
      tenantId,
      userId,
      eventsTotal: 5,
      acceptedAt: new Date('2020-01-01'),
      validUntil: new Date('2020-06-01'),
    })

    const usable = await contractRepo.findNextUsable(tenantId)
    const mostRecent = await contractRepo.findMostRecentAccepted(tenantId)

    expect(usable).toBeNull()
    expect(mostRecent?.contract.id).toBe(expired)
    expect(mostRecent?.eventsUsed).toBe(0)
  })
})
