import { randomBytes, randomUUID } from 'node:crypto'
import { MailService } from '@mail/application/services/mail.service'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { hashSync } from 'bcryptjs'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'

describe('Password reset (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  const enqueued: Array<{ to: string; template: string; vars: Record<string, string> }> = []

  const mailServiceStub = {
    enqueue: jest.fn(async (job) => {
      enqueued.push(job)
    }),
  }

  const email = 'reset-e2e@test.com'
  const originalPassword = 'OriginalPass1!'
  const newPassword = 'BrandNewPass1!'
  let userId: string
  let preResetRefreshTokenId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceStub)
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
    const reflector = app.get(Reflector)
    app.useGlobalInterceptors(new ResponseInterceptor(reflector))
    await app.init()

    prisma = moduleFixture.get(PrismaService)

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashSync(originalPassword, 10),
        first_name: 'Reset',
        last_name: 'Tester',
        is_active: true,
      },
      select: { id: true },
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } })
    await prisma.passwordResetToken.deleteMany({ where: { user_id: userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
    await app.close()
  })

  it('should complete request -> redeem -> login with the new password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: originalPassword })
      .expect(201)

    const preResetToken = await prisma.refreshToken.findFirstOrThrow({
      where: { user_id: userId, revoked_at: null },
      select: { id: true },
    })
    preResetRefreshTokenId = preResetToken.id

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email })
      .expect(202)

    expect(enqueued).toHaveLength(1)
    const resetUrl = enqueued[0].vars.resetUrl
    const token = resetUrl.split('#t=')[1]
    expect(token).toBeDefined()

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password/validate')
      .send({ token })
      .expect(201)
      .expect((res) => expect(res.body.data.valid).toBe(true))

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: originalPassword })
      .expect(422)
  })

  it('should reject the same token a second time', async () => {
    const resetJob = enqueued.find((job) => job.template === 'password-reset')
    const token = resetJob?.vars.resetUrl.split('#t=')[1]
    expect(token).toBeDefined()

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'YetAnotherPass1!' })
      .expect(422)
  })

  it('should reject a syntactically valid but never-issued token', async () => {
    const forgedToken = `${randomUUID()}.${randomBytes(32).toString('base64url')}`

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: forgedToken, password: 'ForgedPass1!' })
      .expect(422)
  })

  it('should revoke every refresh token issued before the reset', async () => {
    const preResetToken = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: preResetRefreshTokenId },
      select: { revoked_at: true },
    })
    expect(preResetToken.revoked_at).not.toBeNull()

    const live = await prisma.refreshToken.findMany({
      where: { user_id: userId, revoked_at: null },
      select: { id: true },
    })
    expect(live).toHaveLength(1)
    expect(live[0]?.id).not.toBe(preResetRefreshTokenId)
  })

  it('should answer identically for an unregistered address', async () => {
    const before = enqueued.length

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-here@test.com' })
      .expect(202)

    expect(enqueued).toHaveLength(before)
  })
})
