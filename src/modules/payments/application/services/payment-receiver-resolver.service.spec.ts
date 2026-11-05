import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { PaymentReceiverResolver } from './payment-receiver-resolver.service'

const EVENT_ID = 'event-1'
const TENANT_ID = 'tenant-1'

function buildResolver(
  options: {
    event?: { tenantId: string } | null
    eventMethods?: Array<Record<string, unknown>>
    tenantAccount?: { isUsable: boolean } | null
  } = {},
) {
  const payoutRepo = {
    findActivePayphoneForTenant: jest.fn().mockResolvedValue(options.tenantAccount ?? null),
  }
  const eventPayoutRepo = {
    findByEventId: jest.fn().mockResolvedValue(options.eventMethods ?? []),
  }
  const eventReadRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(options.event === undefined ? { tenantId: TENANT_ID } : options.event),
  }
  const resolver = new PaymentReceiverResolver(
    payoutRepo as never,
    eventPayoutRepo as never,
    eventReadRepo as never,
  )
  return { resolver, payoutRepo }
}

const eventOnlyPayphone = (overrides: Record<string, unknown> = {}) => ({
  provider: 'payphone',
  isActive: true,
  sourcePayoutMethodId: null,
  mode: PaymentMode.SPLIT_RECEIVER,
  receiverIdentifier: '0999999999',
  ...overrides,
})

describe('PaymentReceiverResolver.acceptsCard', () => {
  it('accepts the card when the organizer has an active verified Payphone', async () => {
    const { resolver, payoutRepo } = buildResolver({ tenantAccount: { isUsable: true } })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(true)
    expect(payoutRepo.findActivePayphoneForTenant).toHaveBeenCalledWith(TENANT_ID)
  })

  it('refuses the card when the organizer never configured Payphone', async () => {
    const { resolver } = buildResolver({ tenantAccount: null })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(false)
  })

  it('refuses the card when the organizer Payphone is not usable', async () => {
    const { resolver } = buildResolver({ tenantAccount: { isUsable: false } })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(false)
  })

  it('accepts the card through the event own split receiver even without an organizer account', async () => {
    const { resolver, payoutRepo } = buildResolver({ eventMethods: [eventOnlyPayphone()] })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(true)
    expect(payoutRepo.findActivePayphoneForTenant).not.toHaveBeenCalled()
  })

  it('refuses the card when the event own Payphone lacks its receiver, instead of throwing', async () => {
    const { resolver } = buildResolver({
      eventMethods: [eventOnlyPayphone({ receiverIdentifier: null })],
      tenantAccount: { isUsable: true },
    })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(false)
  })

  it('falls back to the organizer account when the event Payphone is copied from it', async () => {
    const { resolver } = buildResolver({
      eventMethods: [eventOnlyPayphone({ sourcePayoutMethodId: 'tenant-method-1' })],
      tenantAccount: { isUsable: true },
    })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(true)
  })

  it('refuses the card for an event that does not exist', async () => {
    const { resolver } = buildResolver({ event: null, tenantAccount: { isUsable: true } })

    await expect(resolver.acceptsCard(EVENT_ID)).resolves.toBe(false)
  })
})
