import { Logger } from '@nestjs/common'
import { OrderInvoiceSyncProcessor } from './order-invoice-sync.processor'

describe('OrderInvoiceSyncProcessor', () => {
  const view = { state: 'authorized' }

  const setup = (options: { configured?: boolean; orderIds: string[]; views: unknown[] }) => {
    const views = [...options.views]
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue(options.orderIds.map((id) => ({ id }))),
        update: jest.fn().mockResolvedValue(undefined),
      },
    }
    const syncService = { syncOrder: jest.fn(async () => views.shift() ?? null) }
    const client = { isConfigured: () => options.configured ?? true }
    const processor = new OrderInvoiceSyncProcessor(
      client as never,
      syncService as never,
      prisma as never,
    )
    return { processor, prisma, syncService }
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
  })
  afterEach(() => jest.restoreAllMocks())

  it('syncs only the order of a follow-up job, without scanning the batch', async () => {
    const { processor, prisma, syncService } = setup({ orderIds: ['o-9'], views: [view] })

    await processor.process({ name: 'sync-order', data: { orderId: 'o-1' } } as never)

    expect(syncService.syncOrder).toHaveBeenCalledWith('o-1')
    expect(prisma.order.findMany).not.toHaveBeenCalled()
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining('orderId=o-1 state=authorized'),
    )
  })

  it('logs every run with the orders taken and their resulting state', async () => {
    const { processor } = setup({ orderIds: ['o-1', 'o-2'], views: [view, null] })

    await processor.process()

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'invoice sync run: 2 orders (o-1=authorized, o-2=no answer)',
    )
  })

  it('does nothing while rikuchiy is not configured', async () => {
    const { processor, prisma } = setup({ configured: false, orderIds: ['o-1'], views: [] })

    await processor.process()

    expect(prisma.order.findMany).not.toHaveBeenCalled()
  })

  it('selects the orders that can change and the ones flagged after a delivery', async () => {
    const { processor, prisma } = setup({ orderIds: [], views: [] })

    await processor.process()

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { invoice_state: { in: ['requested', 'in_process'] } },
          { invoice_state: { not: 'none' }, invoice_synced_at: null },
        ],
      },
      select: { id: true },
      orderBy: { invoice_synced_at: { sort: 'asc', nulls: 'first' } },
      take: 50,
    })
  })

  it('sends an order whose read failed to the back of the queue', async () => {
    const { processor, prisma, syncService } = setup({
      orderIds: ['o-1', 'o-2', 'o-3'],
      views: [view, null, view],
    })

    await processor.process()

    expect(syncService.syncOrder.mock.calls).toEqual([['o-1'], ['o-2'], ['o-3']])
    expect(prisma.order.update).toHaveBeenCalledTimes(1)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o-2' },
      data: { invoice_synced_at: expect.any(Date) },
    })
  })

  it('stops the batch after three reads in a row fail', async () => {
    const { processor, prisma, syncService } = setup({
      orderIds: ['o-1', 'o-2', 'o-3', 'o-4', 'o-5', 'o-6'],
      views: [null, view, null, null, null, view],
    })

    await processor.process()

    expect(syncService.syncOrder.mock.calls).toEqual([['o-1'], ['o-2'], ['o-3'], ['o-4'], ['o-5']])
    expect(prisma.order.update).toHaveBeenCalledTimes(4)
  })
})
