import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { RIKUCHIY_CLIENT } from '../src/shared/rikuchiy/domain/ports'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'

interface BillingAccountBody {
  id: string
  idType: string
  idNumber: string
  legalName: string
  email: string
  address: string | null
  isDefault: boolean
}

describe('Billing accounts — edit (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let owner: TestAuthUser
  let stranger: TestAuthUser
  let accountId: string

  const rikuchiyStub = {
    isConfigured: () => true,
    validateIdentification: jest.fn(),
  }

  const base = '/api/v1/users/me/billing-accounts'
  const as = (user: TestAuthUser) => ({ Authorization: `Bearer ${user.token}` })

  async function accountsOf(user: TestAuthUser): Promise<BillingAccountBody[]> {
    const res = await request(app.getHttpServer()).get(base).set(as(user)).expect(200)
    return res.body.data.accounts
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RIKUCHIY_CLIENT)
      .useValue(rikuchiyStub)
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
    const jwt = moduleFixture.get(JwtService)
    owner = await createAuthenticatedUser(prisma as never, jwt, 'customer')
    stranger = await createAuthenticatedUser(prisma as never, jwt, 'customer')
  })

  beforeEach(() => {
    rikuchiyStub.validateIdentification.mockReset().mockResolvedValue({ valid: true, reason: null })
  })

  afterAll(async () => {
    const userIds = [owner?.userId, stranger?.userId].filter(Boolean)
    await prisma.billingAccount.deleteMany({ where: { user_id: { in: userIds } } })
    await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await app.close()
  })

  it('creates the account the rest of the flow edits', async () => {
    const res = await request(app.getHttpServer())
      .post(base)
      .set(as(owner))
      .send({
        idType: 'national_id',
        idNumber: '1710034065',
        legalName: 'Juan Pérez',
        email: 'juan@correo.com',
        address: 'Av. Amazonas N24-03',
      })
      .expect(201)

    accountId = res.body.data.id
    expect((await accountsOf(owner))[0]).toMatchObject({ id: accountId, isDefault: true })
  })

  it('edits the name and clears the address, and reads the change back', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ legalName: '  Juan P. Pérez ', address: null })
      .expect(200)

    expect(res.body.data).toEqual({ id: accountId })
    expect(await accountsOf(owner)).toEqual([
      {
        id: accountId,
        idType: 'national_id',
        idNumber: '1710034065',
        legalName: 'Juan P. Pérez',
        email: 'juan@correo.com',
        address: null,
        isDefault: true,
      },
    ])
    expect(rikuchiyStub.validateIdentification).not.toHaveBeenCalled()
  })

  it('changes the identification after the external validation accepts it', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ idType: 'ruc', idNumber: '1790012345001' })
      .expect(200)

    expect(rikuchiyStub.validateIdentification).toHaveBeenCalledWith('04', '1790012345001')
    expect((await accountsOf(owner))[0]).toMatchObject({ idType: 'ruc', idNumber: '1790012345001' })
  })

  it('answers 422 and changes nothing when the external validation rejects it', async () => {
    rikuchiyStub.validateIdentification.mockResolvedValue({ valid: false, reason: 'check_digit' })

    const res = await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ idType: 'national_id', idNumber: '0926687856', legalName: 'No Debe Guardarse' })
      .expect(422)

    expect(res.body.error.code).toBe('BUSINESS_RULE')
    expect((await accountsOf(owner))[0]).toMatchObject({
      idType: 'ruc',
      idNumber: '1790012345001',
      legalName: 'Juan P. Pérez',
    })
  })

  it.each([
    ['a cédula with a wrong check digit', 'national_id', '1700000002'],
    ['a company RUC with a wrong check digit', 'ruc', '1790012345001'],
  ])('refuses %s when the external validation cannot answer, saving nothing', async (_, idType, idNumber) => {
    rikuchiyStub.validateIdentification.mockResolvedValue(null)
    const before = (await accountsOf(owner)).length

    const res = await request(app.getHttpServer())
      .post(base)
      .set(as(owner))
      .send({ idType, idNumber, legalName: 'No Debe Guardarse', email: 'no@correo.com' })
      .expect(422)

    expect(res.body.error).toMatchObject({
      code: 'BUSINESS_RULE',
      messageKey: 'billing.identification_invalid',
    })
    expect(await accountsOf(owner)).toHaveLength(before)
  })

  it('answers 404 to someone else trying to edit the account, and leaves it untouched', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(stranger))
      .send({ legalName: 'Intruso' })
      .expect(404)

    expect((await accountsOf(owner))[0].legalName).toBe('Juan P. Pérez')
    expect(await accountsOf(stranger)).toEqual([])
  })

  it('answers 404 for an account that does not exist', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/00000000-0000-4000-8000-000000000000`)
      .set(as(owner))
      .send({ legalName: 'Nadie' })
      .expect(404)
  })

  it('answers 400 to idType without idNumber', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ idType: 'ruc' })
      .expect(400)
  })

  it('answers 400 to a field outside the contract', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ isDefault: false })
      .expect(400)
  })

  it('accepts an empty body as a no-op', async () => {
    const before = await accountsOf(owner)

    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({})
      .expect(200)

    expect(await accountsOf(owner)).toEqual(before)
  })

  it('answers 404 once the account is deleted', async () => {
    await request(app.getHttpServer()).delete(`${base}/${accountId}`).set(as(owner)).expect(200)

    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .set(as(owner))
      .send({ legalName: 'Ya Borrada' })
      .expect(404)
  })

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .patch(`${base}/${accountId}`)
      .send({ legalName: 'Anónimo' })
      .expect(401)
  })
})
