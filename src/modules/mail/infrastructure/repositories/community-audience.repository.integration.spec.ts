import { randomUUID } from 'node:crypto'
import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { CommunityAudienceRepository } from './community-audience.repository'

describe('community audience repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: CommunityAudienceRepository
  let countryId: number
  const userIds: string[] = []
  const today = '2026-12-24'

  const newUser = async (opts: { birthDate?: string; optIn?: boolean; active?: boolean }) => {
    const user = await prisma.user.create({
      data: {
        email: `community-${randomUUID()}@test.local`,
        password_hash: 'x',
        first_name: 'Ana',
        is_active: opts.active ?? true,
        customer_profile: {
          create: {
            country_id: countryId,
            birth_date: opts.birthDate ? new Date(`${opts.birthDate}T00:00:00.000Z`) : null,
          },
        },
      },
    })
    userIds.push(user.id)
    if (opts.optIn ?? true) {
      await prisma.userConsent.create({
        data: {
          user_id: user.id,
          type: CONSENT_TYPE.COMMUNITY_EMAILS,
          policy_version: '2026-11-22',
        },
      })
    }
    return user.id
  }

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
      providers: [PrismaService, CommunityAudienceRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(CommunityAudienceRepository)
    const country = await prisma.country.findFirstOrThrow({ select: { id: true } })
    countryId = country.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await module.close()
  })

  it('reaches active adults who opted in, and nobody else', async () => {
    const adult = await newUser({ birthDate: '1990-05-10' })
    const noBirthDate = await newUser({})
    const minor = await newUser({ birthDate: '2012-03-01' })
    const noConsent = await newUser({ birthDate: '1990-05-10', optIn: false })
    const inactive = await newUser({ birthDate: '1990-05-10', active: false })
    const revoked = await newUser({ birthDate: '1990-05-10' })
    await prisma.userConsent.updateMany({
      where: { user_id: revoked },
      data: { revoked_at: new Date() },
    })

    const audience = await repository.findAudience('christmas', today)

    expect(audience).toEqual(expect.arrayContaining([adult, noBirthDate]))
    for (const excluded of [minor, noConsent, inactive, revoked]) {
      expect(audience).not.toContain(excluded)
    }
  })

  it('picks for the birthday only who was born that day', async () => {
    const birthday = await newUser({ birthDate: '1991-12-24' })
    const other = await newUser({ birthDate: '1991-12-25' })

    const audience = await repository.findAudience('birthday', today)

    expect(audience).toContain(birthday)
    expect(audience).not.toContain(other)
  })

  it('records a send once and reports it', async () => {
    const userId = await newUser({ birthDate: '1990-05-10' })

    expect(await repository.hasSent(userId, 'christmas-2026')).toBe(false)
    await repository.recordSent(userId, 'christmas-2026')
    await repository.recordSent(userId, 'christmas-2026')

    expect(await repository.hasSent(userId, 'christmas-2026')).toBe(true)
    expect(await prisma.communityEmailSend.count({ where: { user_id: userId } })).toBe(1)
  })

  it('stops finding a recipient once they unsubscribe', async () => {
    const userId = await newUser({ birthDate: '1990-05-10' })
    expect(await repository.findEligible(userId, today)).toMatchObject({ firstName: 'Ana' })

    await prisma.userConsent.updateMany({
      where: { user_id: userId },
      data: { revoked_at: new Date() },
    })

    expect(await repository.findEligible(userId, today)).toBeNull()
  })
})
