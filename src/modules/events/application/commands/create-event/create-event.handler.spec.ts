import { AppException } from '../../../../../shared/domain/exceptions/app.exception'
import type { Event } from '../../../domain/entities/event.entity'
import type { EventWriteRepository } from '../../../infrastructure/repositories/event-write.repository'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let repository: jest.Mocked<EventWriteRepository>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<EventWriteRepository>
    handler = new CreateEventHandler(repository)
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, 'Ambato')

    repository.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
    expect(repository.save).toHaveBeenCalledTimes(1)
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Event',
        status: 'draft',
      }),
    )
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand('Test Event', new Date('2020-01-01'), null)

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(repository.save).not.toHaveBeenCalled()
  })
})
