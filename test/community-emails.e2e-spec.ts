import { randomUUID } from 'node:crypto'
import { MailService } from '@mail/application/services/mail.service'
import { type IUnsubscribeTokenService, UNSUBSCRIBE_TOKEN_SERVICE } from '@mail/domain/community'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'

describe('Community emails (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let tokens: IUnsubscribeTokenService
  let countryId: number
  const emails: string[] = []
  const enqueued: Array<{ to: string; template: string; vars: Record<string, string> }> = []

  const register = async (birthDate: string, communityEmails: boolean, guardian = false) => {
    const email = `community-e2e-${randomUUID()}@test.com`
    emails.push(email)
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Ana',
        lastName: 'Rivas',
        phoneNumber: '+593991234567',
        countryId,
        birthDate,
        acceptedTerms: true,
        ...(guardian ? { guardianConsent: true } : {}),
        communityEmails,
      })
      .expect(201)
    const accessToken: string = res.body.data?.accessToken ?? res.body.accessToken
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
    return { email, accessToken, userId: user.id }
  }

  const me = async (accessToken: string) => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
    return res.body.data ?? res.body
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ enqueue: jest.fn(async (job) => enqueued.push(job)) })
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new GlobalExceptionFilter())
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await ensurePaymentSystemUser(moduleFixture.get(PrismaService))
    await app.init()

    prisma = moduleFixture.get(PrismaService)
    tokens = moduleFixture.get(UNSUBSCRIBE_TOKEN_SERVICE)
    countryId = (await prisma.country.findFirstOrThrow({ select: { id: true } })).id
  })

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    })
    const ids = users.map((u) => u.id)
    await prisma.userConsent.deleteMany({ where: { user_id: { in: ids } } })
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined)
    await app.close()
  })

  it('an adult opts in at sign-up, gets the welcome, and leaves from the email link without a session', async () => {
    const { email, accessToken, userId } = await register('1990-05-10', true)

    expect(enqueued).toContainEqual(
      expect.objectContaining({
        to: email,
        template: 'welcome',
        vars: expect.objectContaining({ communityEmails: 'true' }),
      }),
    )
    expect(await me(accessToken)).toMatchObject({
      communityEmails: true,
      communityEmailsAvailable: true,
    })

    const res = await request(app.getHttpServer())
      .post(`/api/v1/mail/unsubscribe?token=${encodeURIComponent(tokens.sign(userId))}`)
      .expect(200)
    expect(res.body.data ?? res.body).toEqual({ unsubscribed: true })
    expect((await me(accessToken)).communityEmails).toBe(false)
  })

  it('turns community emails on and off from the account', async () => {
    const { accessToken } = await register('1990-05-10', false)
    const auth = { Authorization: `Bearer ${accessToken}` }

    await request(app.getHttpServer())
      .post('/api/v1/auth/consents')
      .set(auth)
      .send({ types: ['community_emails'] })
      .expect(204)
    expect((await me(accessToken)).communityEmails).toBe(true)

    await request(app.getHttpServer())
      .post('/api/v1/auth/consents/revoke')
      .set(auth)
      .send({ types: ['community_emails'] })
      .expect(204)
    expect((await me(accessToken)).communityEmails).toBe(false)
  })

  it('never withdraws the legal consents from the account', async () => {
    const { accessToken } = await register('1990-05-10', false)

    await request(app.getHttpServer())
      .post('/api/v1/auth/consents/revoke')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ types: ['terms_privacy'] })
      .expect(400)
  })

  it('rejects an unsubscribe link it did not sign', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/mail/unsubscribe?token=forged.token')
      .expect(422)
  })

  it('never activates community emails for a minor', async () => {
    const minorBirth = `${new Date().getFullYear() - 12}-03-01`
    const { accessToken } = await register(minorBirth, true, true)

    expect(await me(accessToken)).toMatchObject({
      communityEmails: false,
      communityEmailsAvailable: false,
    })
  })
})
