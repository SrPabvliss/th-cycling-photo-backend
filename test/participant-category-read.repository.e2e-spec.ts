import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import configuration from '../src/config/configuration'
import { ParticipantCategoryReadRepository } from '../src/modules/participant-categories/infrastructure/repositories/participant-category-read.repository'
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service'

describe('ParticipantCategoryReadRepository (integration)', () => {
  let prisma: PrismaService
  let repo: ParticipantCategoryReadRepository
  let eventTypeId: number

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'test'}`, '.env'],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService, ParticipantCategoryReadRepository],
    }).compile()
    prisma = moduleRef.get(PrismaService)
    repo = moduleRef.get(ParticipantCategoryReadRepository)
    await prisma.$connect()
  })

  beforeEach(async () => {
    const eventType = await prisma.eventType.create({
      data: { name: `pcat-int-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
    })
    eventTypeId = eventType.id
  })

  afterEach(async () => {
    await prisma.participantCategory.deleteMany({ where: { event_type_id: eventTypeId } })
    await prisma.eventType.delete({ where: { id: eventTypeId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns categories for the given event type sorted by name', async () => {
    await prisma.participantCategory.createMany({
      data: [
        { name: 'Sub-23', event_type_id: eventTypeId },
        { name: 'Elite', event_type_id: eventTypeId },
        { name: 'Master 35', event_type_id: eventTypeId },
      ],
    })

    const result = await repo.findByEventType(eventTypeId)

    expect(result.map((c) => c.name)).toEqual(['Elite', 'Master 35', 'Sub-23'])
    result.forEach((c) => {
      expect(typeof c.id).toBe('number')
    })
  })

  it('returns empty array when event type has no categories', async () => {
    const result = await repo.findByEventType(eventTypeId)
    expect(result).toEqual([])
  })
})
