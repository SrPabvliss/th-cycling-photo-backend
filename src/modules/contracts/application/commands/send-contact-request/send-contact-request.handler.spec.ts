import { SendContactRequestCommand } from './send-contact-request.command'
import { SendContactRequestHandler } from './send-contact-request.handler'

describe('SendContactRequestHandler', () => {
  const user = { id: 'u1', email: 'ana@andes.test', firstName: 'Ana', lastName: 'Pérez' }
  const contract = (validUntil: Date) => ({
    contract: { commercialName: 'Andes Bike 2026', eventsTotal: 3, validUntil },
    eventsUsed: 3,
  })

  const build = (
    overrides: { usable?: unknown; latest?: unknown; tenantId?: string | null } = {},
  ) => {
    const userRepo = {
      findById: jest.fn().mockResolvedValue(user),
      findTenantId: jest
        .fn()
        .mockResolvedValue(overrides.tenantId === undefined ? 't1' : overrides.tenantId),
    }
    const contractRepo = {
      findNextUsable: jest.fn().mockResolvedValue(overrides.usable ?? null),
      findMostRecentAccepted: jest.fn().mockResolvedValue(overrides.latest ?? null),
    }
    const mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'mail.contactInbox' ? 'info@titantv.test' : 'https://titantv.test',
      ),
    }
    const handler = new SendContactRequestHandler(
      userRepo as never,
      contractRepo as never,
      mailService as never,
      config as never,
    )
    return { handler, mailService }
  }

  const command = new SendContactRequestCommand('u1', 'more_quota', 2, 'Necesito dos eventos más')

  it('mails Titan TV with the organizer as reply-to and confirms to the organizer', async () => {
    const future = new Date(Date.now() + 86_400_000)
    const { handler, mailService } = build({ latest: contract(future) })

    await expect(handler.execute(command)).resolves.toEqual({ sent: true })

    const [toTitan, toOrganizer] = mailService.enqueue.mock.calls.map(([job]) => job)
    expect(toTitan).toMatchObject({
      to: 'info@titantv.test',
      replyTo: 'ana@andes.test',
      template: 'tenant-contact-request',
    })
    expect(toTitan.vars).toMatchObject({
      organizerName: 'Ana Pérez',
      reasonLabel: 'Más cupo de eventos',
      eventsWanted: '2',
      contractStatus: 'Vigente',
      contractName: 'Andes Bike 2026',
      eventsUsed: '3',
      eventsTotal: '3',
    })
    expect(toOrganizer).toMatchObject({
      to: 'ana@andes.test',
      template: 'tenant-contact-confirmation',
    })
  })

  it('says there is no current contract instead of failing', async () => {
    const { handler, mailService } = build()

    await handler.execute(new SendContactRequestCommand('u1', 'renewal', null, 'Quiero renovar'))

    const toTitan = mailService.enqueue.mock.calls[0][0]
    expect(toTitan.vars).toMatchObject({
      contractStatus: 'Sin contrato vigente',
      contractName: '',
      eventsWanted: '—',
    })
  })

  it('treats an expired contract as not current', async () => {
    const past = new Date(Date.now() - 86_400_000)
    const { handler, mailService } = build({ latest: contract(past) })

    await handler.execute(command)

    expect(mailService.enqueue.mock.calls[0][0].vars.contractStatus).toBe('Sin contrato vigente')
  })

  it('refuses a user without a tenant', async () => {
    const { handler, mailService } = build({ tenantId: null })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'tenant.not_a_tenant_member',
    })
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })
})
