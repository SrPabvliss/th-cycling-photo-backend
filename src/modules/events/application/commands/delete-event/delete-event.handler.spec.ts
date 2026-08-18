import { Event } from '@events/domain/entities'
import { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { DeleteEventCommand } from './delete-event.command'
import { DeleteEventHandler } from './delete-event.handler'

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>
  let authz: jest.Mocked<IAuthorizationService>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    readRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
      getEventDetailBySlug: jest.fn(),
      countAll: jest.fn(),
      getPublicEventsList: jest.fn(),
      getPublicEventDetail: jest.fn(),
      getPublicPhotos: jest.fn(),
      existsActiveEvent: jest.fn(),
      existsActiveEventBySlug: jest.fn(),
      getAssignedEventsByStatus: jest.fn(),
      countAssignedEventsByStatus: jest.fn(),
      getAssignedEventIdsByStatus: jest.fn(),
      getAllAssignedEventIds: jest.fn(),
      getEventBriefsByIds: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    authz = {
      can: jest.fn(),
      assert: jest.fn(),
      resolveEventScope: jest.fn(),
    } as jest.Mocked<IAuthorizationService>

    handler = new DeleteEventHandler(writeRepo, readRepo, authz)
  })

  it('should archive an existing event and return its id', async () => {
    const existingEvent = Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      startDate: futureDate,
      endDate: futureDate,
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    readRepo.findById.mockResolvedValue(existingEvent)
    writeRepo.save.mockImplementation(async (event) => event)
    authz.assert.mockResolvedValue(undefined)

    const command = new DeleteEventCommand(existingEvent.id, 'u1')
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingEvent.id })
    expect(readRepo.findById).toHaveBeenCalledWith(existingEvent.id)
    expect(authz.assert).toHaveBeenCalledWith('u1', 'event.delete', existingEvent.id)
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }))
  })

  it('should throw 404 when event does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    const command = new DeleteEventCommand('non-existent-id', 'u1')

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should throw when the caller lacks event.delete', async () => {
    readRepo.findById.mockResolvedValue(existingEventFixture())
    authz.assert.mockRejectedValue(new Error('Insufficient permissions'))

    const command = new DeleteEventCommand('550e8400-e29b-41d4-a716-446655440000', 'u1')

    await expect(handler.execute(command)).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  function existingEventFixture() {
    return Event.fromPersistence({
      slug: 'test-event',
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'Vuelta Ciclística',
      startDate: futureDate,
      endDate: futureDate,
      provinceId: null,
      cantonId: null,
      eventTypeId: 1,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
  }
})
