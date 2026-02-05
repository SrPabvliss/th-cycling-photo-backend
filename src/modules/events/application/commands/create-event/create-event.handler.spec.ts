import { AppException } from '../../../../../shared/domain/exceptions/app.exception'
import type { Event } from '../../../domain/entities/event.entity'
import type { IEventWriteRepository } from '../../../domain/ports/event-write-repository.port'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>
    handler = new CreateEventHandler(writeRepo)
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, 'Ambato')

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(writeRepo.save).toHaveBeenCalledTimes(1)
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Event',
        status: 'draft',
      }),
    )
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand('Test Event', new Date('2020-01-01'), null)

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
