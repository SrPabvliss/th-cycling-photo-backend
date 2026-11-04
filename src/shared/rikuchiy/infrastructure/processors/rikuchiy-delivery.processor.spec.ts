import { Logger } from '@nestjs/common'
import type { AnnulmentResult, EmissionOutcome } from '../../domain/ports'
import { RikuchiyAnnulment } from '../../domain/rikuchiy-annulment'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { RikuchiyDeliveryProcessor } from './rikuchiy-delivery.processor'

describe('RikuchiyDeliveryProcessor', () => {
  const item = (id: string, orderId: string) => ({
    id,
    orderId,
    kind: 'emit' as const,
    externalRef: orderId,
    payload: { emissionId: `e-${id}` } as unknown as RikuchiyEmissionPayload,
  })

  const setup = (options: {
    configured: boolean
    outcomes?: EmissionOutcome[]
    stillPending?: boolean
    items?: unknown[]
    annulResults?: AnnulmentResult[]
    orderStatus?: string
    rows?: unknown[]
  }) => {
    const outbox = {
      findPending: jest
        .fn()
        .mockResolvedValue(
          options.items ?? [item('1', 'order-1'), item('2', 'order-2'), item('3', 'order-3')],
        ),
      enqueue: jest.fn().mockResolvedValue(true),
      markSent: jest.fn().mockResolvedValue(options.stillPending ?? true),
      markRejected: jest.fn().mockResolvedValue(undefined),
      markAttemptFailed: jest.fn().mockResolvedValue(undefined),
      markWithdrawnSent: jest.fn().mockResolvedValue(undefined),
      findByOrder: jest.fn().mockResolvedValue(options.rows ?? []),
    }
    const sent: string[] = []
    const outcomes = [...(options.outcomes ?? [])]
    const annulResults = [...(options.annulResults ?? [])]
    const client = {
      isConfigured: jest.fn().mockReturnValue(options.configured),
      emit: jest.fn(async (payload: RikuchiyEmissionPayload) => {
        sent.push(payload.emissionId)
        return outcomes.shift()
      }),
      annul: jest.fn(async () => annulResults.shift()),
    }
    const tx = {}
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ status: options.orderStatus ?? 'paid' }),
      },
      $transaction: jest.fn(async (work: (client: unknown) => unknown) => work(tx)),
    }
    const refresher = {
      refresh: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn().mockResolvedValue(undefined),
    }
    const processor = new RikuchiyDeliveryProcessor(
      outbox as never,
      client as never,
      prisma as never,
      refresher as never,
    )
    return { processor, outbox, client, sent, prisma, tx, refresher }
  }

  afterEach(() => jest.restoreAllMocks())

  it('does nothing while rikuchiy is not configured', async () => {
    const { processor, outbox, client } = setup({ configured: false })

    await processor.process()

    expect(outbox.findPending).not.toHaveBeenCalled()
    expect(client.emit).not.toHaveBeenCalled()
  })

  it('settles each emission by what rikuchiy answered, one at a time and in order', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const { processor, outbox, sent, refresher } = setup({
      configured: true,
      outcomes: [
        { kind: 'accepted', taxDocumentId: 'td-1' },
        {
          kind: 'rejected',
          reason: '422 BUSINESS_RULE: Identificación inválida',
          message: 'Identificación inválida',
        },
        { kind: 'retry', reason: '500 INTERNAL: boom' },
      ],
    })

    await processor.process()

    expect(outbox.findPending).toHaveBeenCalledWith(50)
    expect(sent).toEqual(['e-1', 'e-2', 'e-3'])
    expect(outbox.markSent).toHaveBeenCalledWith('1', {
      taxDocumentId: 'td-1',
      outcome: null,
    })
    expect(outbox.markRejected).toHaveBeenCalledWith('2', 'Identificación inválida')
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('422 BUSINESS_RULE: Identificación inválida'),
    )
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith('3', '500 INTERNAL: boom')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('order-2'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('order-3'))
    expect(refresher.settle.mock.calls).toEqual([['order-1'], ['order-2']])
    expect(refresher.refresh).not.toHaveBeenCalled()
  })

  it('records the acceptance and enqueues an annulment when a withdrawn emission turns out sent', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { processor, outbox, tx, refresher } = setup({
      configured: true,
      stillPending: false,
      items: [item('1', 'order-1')],
      outcomes: [{ kind: 'accepted', taxDocumentId: 'td-1' }],
    })

    await processor.process()

    expect(outbox.markWithdrawnSent).toHaveBeenCalledWith(
      '1',
      { taxDocumentId: 'td-1', outcome: null },
      tx,
    )
    expect(outbox.markWithdrawnSent.mock.invocationCallOrder[0]).toBeLessThan(
      outbox.enqueue.mock.invocationCallOrder[0],
    )
    expect(outbox.enqueue).toHaveBeenCalledTimes(1)
    const [entry, client] = outbox.enqueue.mock.calls[0]
    expect(client).toBe(tx)
    expect(entry).toMatchObject({
      orderId: 'order-1',
      kind: 'annul',
      externalRef: 'order-1',
    })
    expect(entry.payload).toEqual(RikuchiyAnnulment.build(entry.emissionId, 'cancelled'))
    expect(refresher.settle).toHaveBeenCalledWith('order-1', tx)
    expect(error).not.toHaveBeenCalled()
  })

  it('does not enqueue a second annulment when the withdrawn reference already has a live one', async () => {
    const { processor, outbox, tx, refresher } = setup({
      configured: true,
      stillPending: false,
      items: [item('1', 'order-1')],
      outcomes: [{ kind: 'accepted', taxDocumentId: 'td-1' }],
      rows: [
        { kind: 'emit', status: 'sent', externalRef: 'order-1' },
        { kind: 'annul', status: 'pending', externalRef: 'order-1' },
      ],
    })

    await processor.process()

    expect(outbox.markWithdrawnSent).toHaveBeenCalledWith(
      '1',
      { taxDocumentId: 'td-1', outcome: null },
      tx,
    )
    expect(outbox.findByOrder).toHaveBeenCalledWith('order-1', tx)
    expect(outbox.enqueue).not.toHaveBeenCalled()
    expect(refresher.settle).toHaveBeenCalledWith('order-1', tx)
  })

  it('annuls as a gift when the withdrawn order was gifted', async () => {
    const { processor, outbox } = setup({
      configured: true,
      stillPending: false,
      orderStatus: 'gifted',
      items: [item('1', 'order-1')],
      outcomes: [{ kind: 'accepted', taxDocumentId: 'td-1' }],
    })

    await processor.process()

    const [entry] = outbox.enqueue.mock.calls[0]
    expect(entry.payload).toEqual(RikuchiyAnnulment.build(entry.emissionId, 'gifted'))
  })

  describe('annul rows', () => {
    const annulItem = {
      id: 'a1',
      orderId: 'order-1',
      kind: 'annul' as const,
      externalRef: 'order-1-2',
      payload: { emissionId: 'ae-1', reason: 'Pedido cancelado' },
    }

    it('sends annul rows through annul and records the outcome', async () => {
      const { processor, outbox, client, refresher } = setup({
        configured: true,
        items: [annulItem],
        annulResults: [{ kind: 'accepted', outcome: 'credit_note', creditNoteId: 'cn-1' }],
      })

      await processor.process()

      expect(client.annul).toHaveBeenCalledWith('order-1-2', annulItem.payload)
      expect(client.emit).not.toHaveBeenCalled()
      expect(outbox.markSent).toHaveBeenCalledWith('a1', {
        taxDocumentId: 'cn-1',
        outcome: 'credit_note',
      })
      expect(refresher.settle).toHaveBeenCalledWith('order-1')
    })

    it('logs an error when rikuchiy answers stands', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation()
      const { processor, outbox } = setup({
        configured: true,
        items: [annulItem],
        annulResults: [{ kind: 'accepted', outcome: 'stands', creditNoteId: null }],
      })

      await processor.process()

      expect(error).toHaveBeenCalledWith(expect.stringContaining('order-1'))
      expect(outbox.markSent).toHaveBeenCalledWith('a1', {
        taxDocumentId: null,
        outcome: 'stands',
      })
    })

    it('settles a rejected or failed annulment', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation()
      jest.spyOn(Logger.prototype, 'warn').mockImplementation()
      const { processor, outbox, refresher } = setup({
        configured: true,
        items: [annulItem, { ...annulItem, id: 'a2' }],
        annulResults: [
          { kind: 'rejected', reason: '422 BUSINESS_RULE: x', message: 'x' },
          { kind: 'retry', reason: '409 CONFLICT: no invoice' },
        ],
      })

      await processor.process()

      expect(outbox.markRejected).toHaveBeenCalledWith('a1', 'x')
      expect(outbox.markAttemptFailed).toHaveBeenCalledWith('a2', '409 CONFLICT: no invoice')
      expect(refresher.settle.mock.calls).toEqual([['order-1']])
    })
  })
})
