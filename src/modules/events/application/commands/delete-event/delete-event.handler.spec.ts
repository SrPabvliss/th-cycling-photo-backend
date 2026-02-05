import { AppException } from '../../../../../shared/domain/exceptions/app.exception'
import { Event } from '../../../domain/entities/event.entity'
import type { IEventReadRepository } from '../../../domain/ports/event-read-repository.port'
import type { IEventWriteRepository } from '../../../domain/ports/event-write-repository.port'
import { DeleteEventCommand } from './delete-event.command'
import { DeleteEventHandler } from './delete-event.handler'

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const existingEvent = Event.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Vuelta Ciclística',
    date: futureDate,
    location: 'Ambato',
    status: 'draft',
    totalPhotos: 0,
    processedPhotos: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    readRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
    } as jest.Mocked<IEventReadRepository>

    handler = new DeleteEventHandler(writeRepo, readRepo)
  })

  it('should soft-delete an existing event and return its id', async () => {
    readRepo.findById.mockResolvedValue(existingEvent)
    writeRepo.delete.mockResolvedValue(undefined)

    const command = new DeleteEventCommand(existingEvent.id)
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingEvent.id })
    expect(readRepo.findById).toHaveBeenCalledWith(existingEvent.id)
    expect(writeRepo.delete).toHaveBeenCalledWith(existingEvent.id)
  })

  it('should throw 404 when event does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    const command = new DeleteEventCommand('non-existent-id')

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.delete).not.toHaveBeenCalled()
  })
})
