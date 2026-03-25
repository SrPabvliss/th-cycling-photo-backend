import { Event } from '@events/domain/entities'
import { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import { AppException } from '@shared/domain'
import { DeleteEventCommand } from './delete-event.command'
import { DeleteEventHandler } from './delete-event.handler'

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>

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
      countAll: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    handler = new DeleteEventHandler(writeRepo, readRepo)
  })

  it('should archive an existing event and return its id', async () => {
    const existingEvent = Event.fromPersistence({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Vuelta Ciclística',
      description: null,
      date: futureDate,
      location: 'Ambato',
      provinceId: null,
      cantonId: null,
      coverImageUrl: null,
      coverImageStorageKey: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    readRepo.findById.mockResolvedValue(existingEvent)
    writeRepo.save.mockImplementation(async (event) => event)

    const command = new DeleteEventCommand(existingEvent.id)
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingEvent.id })
    expect(readRepo.findById).toHaveBeenCalledWith(existingEvent.id)
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }))
  })

  it('should throw 404 when event does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    const command = new DeleteEventCommand('non-existent-id')

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
