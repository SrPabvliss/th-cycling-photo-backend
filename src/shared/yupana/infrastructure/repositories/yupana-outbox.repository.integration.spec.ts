import { randomUUID } from 'node:crypto'
import { YupanaOutboxKind, YupanaOutboxStatus } from '@generated/prisma/client'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { YupanaOutboxRepository } from './yupana-outbox.repository'

describe('yupana outbox repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: YupanaOutboxRepository
  const createdKeys: string[] = []

  const report = (itemKey: string) => ({
    kind: YupanaOutboxKind.usage_report,
    itemKey,
    photoId: null,
    payload: { report_id: itemKey },
  })

  const newKey = () => {
    const key = `test-${randomUUID()}`
    createdKeys.push(key)
    return key
  }

  const pendingKeys = async () =>
    (await repository.findPending(YupanaOutboxKind.usage_report, 500))
      .map((item) => item.itemKey)
      .filter((key) => createdKeys.includes(key))

  const rowOf = (key: string) =>
    prisma.yupanaOutboxItem.findUniqueOrThrow({ where: { item_key: key } })

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
      providers: [PrismaService, YupanaOutboxRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(YupanaOutboxRepository)
  })

  afterAll(async () => {
    await prisma.yupanaOutboxItem.deleteMany({ where: { item_key: { in: createdKeys } } })
    await module.close()
  })

  it('returns pending entries oldest first and ignores a repeated key', async () => {
    const first = newKey()
    const second = newKey()
    await repository.enqueue([report(first)])
    await repository.enqueue([report(second), report(first)])

    expect(await pendingKeys()).toEqual([first, second])
  })

  it('takes sent entries out of the pending set', async () => {
    const key = newKey()
    await repository.enqueue([report(key)])

    await repository.markSent([(await rowOf(key)).id])

    expect(await pendingKeys()).not.toContain(key)
    const row = await rowOf(key)
    expect(row.status).toBe(YupanaOutboxStatus.sent)
    expect(row.sent_at).not.toBeNull()
  })

  it('keeps the reason of a rejected entry', async () => {
    const key = newKey()
    await repository.enqueue([report(key)])

    await repository.markRejected((await rowOf(key)).id, 'payload_invalid')

    const row = await rowOf(key)
    expect(row.status).toBe(YupanaOutboxStatus.rejected)
    expect(row.rejection_reason).toBe('payload_invalid')
  })

  it('counts a failed attempt and keeps the entry pending', async () => {
    const key = newKey()
    await repository.enqueue([report(key)])

    await repository.markAttemptFailed([(await rowOf(key)).id], 'yupana unreachable')

    const row = await rowOf(key)
    expect(row.attempts).toBe(1)
    expect(row.last_error).toBe('yupana unreachable')
    expect(await pendingKeys()).toContain(key)
  })

  it('knows whether a photo was ever declared', async () => {
    const photoId = randomUUID()
    expect(await repository.existsDeclarationForPhoto(photoId)).toBe(false)

    await repository.enqueue([{ ...report(newKey()), photoId }])
    expect(await repository.existsDeclarationForPhoto(photoId)).toBe(false)

    await repository.enqueue([
      { kind: YupanaOutboxKind.photo_declaration, itemKey: newKey(), photoId, payload: {} },
    ])
    expect(await repository.existsDeclarationForPhoto(photoId)).toBe(true)
  })
})
