import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { Event } from '@events/domain/entities'
import type {
  IEventPayoutMethodRepository,
  IEventReadRepository,
  IEventWriteRepository,
} from '@events/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import type { PrismaService } from '@shared/infrastructure'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateEventConfigurationCommand } from './update-event-configuration.command'
import { UpdateEventConfigurationDto } from './update-event-configuration.dto'
import { UpdateEventConfigurationHandler } from './update-event-configuration.handler'

describe('UpdateEventConfigurationHandler', () => {
  let handler: UpdateEventConfigurationHandler
  let readRepo: jest.Mocked<IEventReadRepository>
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let payoutRepo: jest.Mocked<IEventPayoutMethodRepository>
  let authz: jest.Mocked<IAuthorizationService>
  let configService: jest.Mocked<EventConfigurationService>
  let kvStorage: { write: jest.Mock; writeBulk: jest.Mock; delete: jest.Mock }
  const unrestrictedScope = EventScope.unrestricted()

  const command = new UpdateEventConfigurationCommand(
    '550e8400-e29b-41d4-a716-446655440000',
    'u1',
    {
      publicName: 'New Public Name',
    },
  )

  const makeEvent = (isFrozen: boolean, snapWatermarkStorageKey: string | null = null): Event =>
    Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      startDate: new Date(),
      endDate: new Date(),
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'active',
      snapPublicName: null,
      snapWatermarkStorageKey,
      snapWhatsappNumber: null,
      isFrozen,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

  const frozenEvent = makeEvent(true)
  const activeEvent = makeEvent(false)

  beforeEach(() => {
    readRepo = {
      findByIdInScope: jest.fn(),
    } as unknown as jest.Mocked<IEventReadRepository>

    writeRepo = {
      save: jest.fn().mockImplementation(async (event) => event),
    } as unknown as jest.Mocked<IEventWriteRepository>

    payoutRepo = {
      findByEventId: jest.fn().mockResolvedValue([]),
      replaceForEvent: jest.fn(),
    } as unknown as jest.Mocked<IEventPayoutMethodRepository>

    authz = {
      assert: jest.fn().mockResolvedValue(undefined),
      canAnywhere: jest.fn().mockResolvedValue(true),
      resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
    } as unknown as jest.Mocked<IAuthorizationService>

    configService = {
      verifyNewPayphones: jest.fn().mockResolvedValue(undefined),
      assertNoRegression: jest.fn(),
      rematerialise: jest.fn().mockResolvedValue({
        brand: { publicName: 'New Public Name', watermarkStorageKey: null, whatsappNumber: null },
        payoutMethods: [],
      }),
    } as unknown as jest.Mocked<EventConfigurationService>

    const prisma = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({})),
    } as unknown as PrismaService

    kvStorage = {
      write: jest.fn().mockResolvedValue(undefined),
      writeBulk: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    handler = new UpdateEventConfigurationHandler(
      readRepo,
      writeRepo,
      payoutRepo,
      kvStorage,
      authz,
      configService,
      prisma,
    )
  })

  it('refuses to edit a frozen event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(frozenEvent)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.frozen_not_editable',
    })
    expect(payoutRepo.replaceForEvent).not.toHaveBeenCalled()
  })

  it('rewrites the snapshot for an active event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)

    await handler.execute(command)

    expect(payoutRepo.replaceForEvent).toHaveBeenCalledWith(
      activeEvent.id,
      expect.any(Array),
      expect.anything(),
    )
  })

  it('refuses an incomplete configuration without touching the event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)
    configService.assertNoRegression.mockImplementation(() => {
      throw AppException.businessRule('event.configuration_incomplete', false, {
        missing: 'whatsapp',
      })
    })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'event.configuration_incomplete',
    })
    expect(payoutRepo.replaceForEvent).not.toHaveBeenCalled()
  })

  it('removes the event watermark from KV when the update clears it', async () => {
    const branded = makeEvent(false, 'tenants/t1/watermark/wm.png')
    readRepo.findByIdInScope.mockResolvedValue(branded)
    configService.rematerialise.mockResolvedValue({
      brand: { publicName: 'Foto Andes', watermarkStorageKey: null, whatsappNumber: '0991234567' },
      payoutMethods: null,
    })

    await handler.execute(
      new UpdateEventConfigurationCommand(branded.id, 'u1', { watermarkStorageKey: null }),
    )

    expect(kvStorage.delete).toHaveBeenCalledWith(`wm-${branded.id}`)
    expect(kvStorage.write).not.toHaveBeenCalled()
  })

  it('leaves KV alone when the event never had its own watermark', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)

    await handler.execute(command)

    expect(kvStorage.delete).not.toHaveBeenCalled()
  })

  it('verifies new payphone numbers before persisting the update', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)
    const selectionCommand = new UpdateEventConfigurationCommand(activeEvent.id, 'u1', {
      payoutMethods: [{ source: 'new', provider: 'payphone', phone: '0991234567' }],
    })

    await handler.execute(selectionCommand)

    expect(configService.verifyNewPayphones).toHaveBeenCalledWith(
      selectionCommand.selection.payoutMethods,
    )
  })

  it('propagates an unverified payphone number without touching the event', async () => {
    readRepo.findByIdInScope.mockResolvedValue(activeEvent)
    configService.verifyNewPayphones.mockRejectedValue(
      AppException.businessRule('payment.phone_not_registered', false, {
        rule: 'phone_not_registered',
      }),
    )
    const selectionCommand = new UpdateEventConfigurationCommand(activeEvent.id, 'u1', {
      payoutMethods: [{ source: 'new', provider: 'payphone', phone: '0991234567' }],
    })

    await expect(handler.execute(selectionCommand)).rejects.toMatchObject({
      messageKey: 'payment.phone_not_registered',
    })
    expect(writeRepo.save).not.toHaveBeenCalled()
    expect(payoutRepo.replaceForEvent).not.toHaveBeenCalled()
  })

  describe('who may choose where the event money lands (TIT-95)', () => {
    const newBank = {
      source: 'new' as const,
      provider: 'bank_transfer' as const,
      bankName: 'Banco Pichincha',
      accountNumber: '2200000000',
      accountType: 'ahorros',
      accountHolder: 'Someone Else',
      holderIdentification: '1700000000',
    }

    beforeEach(() => readRepo.findByIdInScope.mockResolvedValue(activeEvent))

    it.each([
      ['a profile method', { source: 'profile' as const, id: 'profile-bank-id' }],
      [
        'a method the event already has, kept or re-sent untouched',
        { source: 'event' as const, id: 'event-only-id' },
      ],
    ])('lets staff without payout management send %s', async (_label, entry) => {
      authz.canAnywhere.mockResolvedValue(false)

      await handler.execute(
        new UpdateEventConfigurationCommand(activeEvent.id, 'staff-1', { payoutMethods: [entry] }),
      )

      expect(authz.canAnywhere).not.toHaveBeenCalled()
      expect(payoutRepo.replaceForEvent).toHaveBeenCalled()
    })

    it.each([
      ['a new bank account', newBank],
      [
        'a new payphone number',
        { source: 'new' as const, provider: 'payphone' as const, phone: '0991234567' },
      ],
    ])('refuses %s from staff without payout management, before calling Payphone or writing', async (_label, entry) => {
      authz.canAnywhere.mockResolvedValue(false)

      await expect(
        handler.execute(
          new UpdateEventConfigurationCommand(activeEvent.id, 'staff-1', {
            payoutMethods: [{ source: 'event', id: 'event-only-id' }, entry],
          }),
        ),
      ).rejects.toMatchObject({
        messageKey: 'event.payout_method_manage_required',
        httpStatus: 403,
      })

      expect(authz.canAnywhere).toHaveBeenCalledWith('staff-1', 'tenant.payout_method.manage')
      expect(configService.verifyNewPayphones).not.toHaveBeenCalled()
      expect(payoutRepo.replaceForEvent).not.toHaveBeenCalled()
    })

    it('lets a tenant or admin with payout management add a new account', async () => {
      authz.canAnywhere.mockResolvedValue(true)

      await handler.execute(
        new UpdateEventConfigurationCommand(activeEvent.id, 'owner-1', {
          payoutMethods: [newBank],
        }),
      )

      expect(payoutRepo.replaceForEvent).toHaveBeenCalled()
    })

    it('leaves staff free to edit the rest of the configuration when payoutMethods is omitted', async () => {
      authz.canAnywhere.mockResolvedValue(false)

      await handler.execute(
        new UpdateEventConfigurationCommand(activeEvent.id, 'staff-1', {
          publicName: 'Otro nombre',
        }),
      )

      expect(authz.canAnywhere).not.toHaveBeenCalled()
    })
  })

  it('accepts an explicit null watermark key, since the watermark is optional', async () => {
    const dto = plainToInstance(UpdateEventConfigurationDto, { watermarkStorageKey: null })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})
