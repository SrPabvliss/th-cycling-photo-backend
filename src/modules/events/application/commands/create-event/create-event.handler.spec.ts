import { Event } from '@events/domain/entities'
import { IEventWriteRepository } from '@events/domain/ports'
import type { IEventOperatorRepository } from '@events/domain/ports/event-operator-repository.port'
import { LocationValidator } from '@locations/application/services'
import { AuditContext } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserReadRepository } from '@users/domain/ports'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let operatorRepo: jest.Mocked<IEventOperatorRepository>
  let userRepo: jest.Mocked<IUserReadRepository>
  let locationValidator: jest.Mocked<LocationValidator>

  const futureStart = new Date()
  futureStart.setFullYear(futureStart.getFullYear() + 1)
  const futureEnd = new Date(futureStart)
  futureEnd.setDate(futureEnd.getDate() + 2)

  const creatorId = '550e8400-e29b-41d4-a716-446655440000'
  const creatorTenantId = '11111111-1111-4111-8111-111111111111'
  const audit = new AuditContext(creatorId)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    operatorRepo = {
      assign: jest.fn().mockResolvedValue(undefined),
      unassign: jest.fn(),
      findByEvent: jest.fn(),
      isAssigned: jest.fn(),
      findFirstOperatorId: jest.fn().mockResolvedValue(null),
    } as jest.Mocked<IEventOperatorRepository>

    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findTenantId: jest.fn().mockResolvedValue(creatorTenantId),
      getUsersList: jest.fn(),
      getUserDetail: jest.fn(),
      findActiveAdminIds: jest.fn(),
      getBuyersList: jest.fn(),
    } as jest.Mocked<IUserReadRepository>

    locationValidator = {
      validate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocationValidator>

    handler = new CreateEventHandler(writeRepo, operatorRepo, userRepo, locationValidator)
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(locationValidator.validate).toHaveBeenCalledWith(null, null)
    expect(writeRepo.save).toHaveBeenCalledTimes(1)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Event',
        status: 'active',
      }),
    )
  })

  it('creates the event with the creator tenant', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    writeRepo.save.mockImplementation(async (event: Event) => event)

    await handler.execute(command)

    expect(userRepo.findTenantId).toHaveBeenCalledWith(creatorId)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: creatorTenantId }),
    )
  })

  it('rejects creation when the creator has no tenant', async () => {
    userRepo.findTenantId.mockResolvedValue(null)
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow('event.creator_tenant_required')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should create event with valid province and canton', async () => {
    const command = new CreateEventCommand('Test Event', futureStart, futureEnd, 18, 1, 1, audit)

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(locationValidator.validate).toHaveBeenCalledWith(18, 1)
  })

  it('should propagate location validation errors', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      futureStart,
      futureEnd,
      999,
      null,
      1,
      audit,
    )

    locationValidator.validate.mockRejectedValue(
      AppException.businessRule('event.province_not_found'),
    )

    await expect(handler.execute(command)).rejects.toThrow('event.province_not_found')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand(
      'Test Event',
      new Date('2026-06-17'),
      new Date('2026-06-15'),
      null,
      null,
      1,
      audit,
    )

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
