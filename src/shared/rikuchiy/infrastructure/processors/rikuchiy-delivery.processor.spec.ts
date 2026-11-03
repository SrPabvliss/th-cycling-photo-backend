import { Logger } from '@nestjs/common'
import type { EmissionOutcome } from '../../domain/ports'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { RikuchiyDeliveryProcessor } from './rikuchiy-delivery.processor'

describe('RikuchiyDeliveryProcessor', () => {
  const item = (id: string, orderId: string) => ({
    id,
    orderId,
    payload: { emissionId: `e-${id}` } as unknown as RikuchiyEmissionPayload,
  })

  const setup = (options: {
    configured: boolean
    outcomes?: EmissionOutcome[]
    stillPending?: boolean
  }) => {
    const outbox = {
      findPending: jest
        .fn()
        .mockResolvedValue([item('1', 'order-1'), item('2', 'order-2'), item('3', 'order-3')]),
      markSent: jest.fn().mockResolvedValue(options.stillPending ?? true),
      markRejected: jest.fn().mockResolvedValue(undefined),
      markAttemptFailed: jest.fn().mockResolvedValue(undefined),
    }
    const sent: string[] = []
    const outcomes = [...(options.outcomes ?? [])]
    const client = {
      isConfigured: jest.fn().mockReturnValue(options.configured),
      emit: jest.fn(async (payload: RikuchiyEmissionPayload) => {
        sent.push(payload.emissionId)
        return outcomes.shift()
      }),
    }
    const processor = new RikuchiyDeliveryProcessor(outbox as never, client as never)
    return { processor, outbox, client, sent }
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
    const { processor, outbox, sent } = setup({
      configured: true,
      outcomes: [
        { kind: 'accepted', taxDocumentId: 'td-1' },
        { kind: 'rejected', reason: '422 BUSINESS_RULE: Identificación inválida' },
        { kind: 'retry', reason: '500 INTERNAL: boom' },
      ],
    })

    await processor.process()

    expect(outbox.findPending).toHaveBeenCalledWith(50)
    expect(sent).toEqual(['e-1', 'e-2', 'e-3'])
    expect(outbox.markSent).toHaveBeenCalledWith('1', 'td-1')
    expect(outbox.markRejected).toHaveBeenCalledWith(
      '2',
      '422 BUSINESS_RULE: Identificación inválida',
    )
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith('3', '500 INTERNAL: boom')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('order-2'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('order-3'))
  })

  it('warns loudly when rikuchiy issued an invoice for an order withdrawn meanwhile', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { processor } = setup({
      configured: true,
      stillPending: false,
      outcomes: [
        { kind: 'accepted', taxDocumentId: 'td-1' },
        { kind: 'accepted', taxDocumentId: 'td-2' },
        { kind: 'accepted', taxDocumentId: 'td-3' },
      ],
    })

    await processor.process()

    expect(error).toHaveBeenCalledWith(expect.stringContaining('annul it by hand'))
    expect(error).toHaveBeenCalledWith(expect.stringContaining('order-1'))
  })
})
