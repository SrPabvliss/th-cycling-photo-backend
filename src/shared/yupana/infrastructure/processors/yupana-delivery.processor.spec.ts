import { YupanaOutboxKind } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import type { IYupanaClient, IYupanaOutboxRepository } from '../../domain/ports'
import { YupanaDeliveryProcessor } from './yupana-delivery.processor'

describe('YupanaDeliveryProcessor', () => {
  const outbox = {
    enqueue: jest.fn(),
    findPending: jest.fn(),
    markSent: jest.fn(),
    markRejected: jest.fn(),
    markAttemptFailed: jest.fn(),
    existsDeclarationForPhoto: jest.fn(),
  } satisfies jest.Mocked<IYupanaOutboxRepository>

  const client = {
    isConfigured: jest.fn(() => true),
    sendReports: jest.fn(),
    sendDeclarations: jest.fn(),
    read: jest.fn(),
  } satisfies jest.Mocked<IYupanaClient>

  const item = (id: string, itemKey: string) => ({ id, itemKey, payload: { key: itemKey } })

  const pending = (reports: ReturnType<typeof item>[], declarations: ReturnType<typeof item>[]) =>
    outbox.findPending.mockImplementation(async (kind: YupanaOutboxKind) =>
      kind === YupanaOutboxKind.usage_report ? reports : declarations,
    )

  const processor = () => new YupanaDeliveryProcessor(outbox, client)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks accepted and duplicate items sent and keeps the reason of a rejection', async () => {
    pending([item('a', 'r1'), item('b', 'r2'), item('c', 'r3')], [])
    client.sendReports.mockResolvedValue([
      { key: 'r1', outcome: 'accepted', reason: null },
      { key: 'r2', outcome: 'duplicate', reason: null },
      { key: 'r3', outcome: 'rejected', reason: 'payload_invalid' },
    ])

    await processor().process()

    expect(client.sendReports).toHaveBeenCalledWith([{ key: 'r1' }, { key: 'r2' }, { key: 'r3' }])
    expect(outbox.markSent).toHaveBeenCalledWith(['a', 'b'])
    expect(outbox.markRejected).toHaveBeenCalledWith('c', 'payload_invalid')
  })

  it('counts a failed attempt for an item yupana answered nothing about', async () => {
    pending([item('a', 'r1'), item('b', 'r2')], [])
    client.sendReports.mockResolvedValue([{ key: 'r1', outcome: 'accepted', reason: null }])

    await processor().process()

    expect(outbox.markSent).toHaveBeenCalledWith(['a'])
    expect(outbox.markRejected).not.toHaveBeenCalled()
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith(['b'], 'no result in the yupana answer')
  })

  it('does nothing when yupana is not configured', async () => {
    client.isConfigured.mockReturnValueOnce(false)
    pending([item('a', 'r1')], [])

    await processor().process()

    expect(outbox.findPending).not.toHaveBeenCalled()
    expect(client.sendReports).not.toHaveBeenCalled()
  })

  it('counts a failed attempt without throwing and still delivers the declarations', async () => {
    pending([item('a', 'r1')], [item('d', 'p1@t')])
    client.sendReports.mockRejectedValue(AppException.externalService('yupana'))
    client.sendDeclarations.mockResolvedValue([{ key: 'p1@t', outcome: 'accepted', reason: null }])

    await expect(processor().process()).resolves.toBeUndefined()

    expect(outbox.markAttemptFailed).toHaveBeenCalledWith(['a'], expect.any(String))
    expect(outbox.markSent).toHaveBeenCalledWith(['d'])
  })

  it('reads at most one batch of 500 per kind', async () => {
    pending([], [])

    await processor().process()

    expect(outbox.findPending).toHaveBeenCalledWith(YupanaOutboxKind.usage_report, 500)
    expect(outbox.findPending).toHaveBeenCalledWith(YupanaOutboxKind.photo_declaration, 500)
  })

  it('sends nothing when nothing is pending', async () => {
    pending([], [])

    await processor().process()

    expect(client.sendReports).not.toHaveBeenCalled()
    expect(client.sendDeclarations).not.toHaveBeenCalled()
  })
})
