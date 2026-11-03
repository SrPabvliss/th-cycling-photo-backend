import { randomUUID } from 'node:crypto'
import { BillingAccount } from '@billing/domain/entities/billing-account.entity'
import { BillingIdType } from '@billing/domain/value-objects/billing-id-type.vo'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { BillingAccountRepository } from './billing-account.repository'

describe('billing account repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: BillingAccountRepository
  const userIds: string[] = []

  const newUser = async () => {
    const user = await prisma.user.create({
      data: { email: `billing-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    userIds.push(user.id)
    return user.id
  }

  const saveAccount = async (userId: string, legalName: string, isDefault: boolean) => {
    const account = BillingAccount.create({
      userId,
      idType: BillingIdType.NATIONAL_ID,
      idNumber: '1710034065',
      legalName,
      email: 'juan@correo.com',
      address: null,
      isDefault,
    })
    await repository.save(account)
    return account
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
      providers: [PrismaService, BillingAccountRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(BillingAccountRepository)
  })

  afterAll(async () => {
    await prisma.billingAccount.deleteMany({ where: { user_id: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await module.close()
  })

  it('keeps a single default account', async () => {
    const userId = await newUser()
    const first = await saveAccount(userId, 'Juan Pérez', true)
    const second = await saveAccount(userId, 'María Pérez', false)

    await repository.makeDefault(userId, second.id)

    const accounts = await repository.findActiveByUser(userId)
    expect(accounts.filter((account) => account.isDefault).map((account) => account.id)).toEqual([
      second.id,
    ])
    expect(accounts.map((account) => account.id)).toEqual([second.id, first.id])
  })

  it('leaves deleted accounts out', async () => {
    const userId = await newUser()
    const kept = await saveAccount(userId, 'Juan Pérez', true)
    const deleted = await saveAccount(userId, 'María Pérez', false)
    deleted.markDeleted()
    await repository.save(deleted)

    const accounts = await repository.findActiveByUser(userId)

    expect(accounts.map((account) => account.id)).toEqual([kept.id])
    expect(await repository.findActiveById(deleted.id, userId)).toBeNull()
  })

  it('does not find another user account', async () => {
    const owner = await newUser()
    const stranger = await newUser()
    const account = await saveAccount(owner, 'Juan Pérez', true)

    expect(await repository.findActiveById(account.id, stranger)).toBeNull()
    expect((await repository.findActiveById(account.id, owner))?.legalName).toBe('Juan Pérez')
  })
})
