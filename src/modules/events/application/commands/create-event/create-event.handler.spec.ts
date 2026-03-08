import { Event } from '@events/domain/entities'
import { IEventWriteRepository } from '@events/domain/ports'
import { LocationValidator } from '@locations/application/services'
import { AppException } from '@shared/domain'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let locationValidator: jest.Mocked<LocationValidator>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>

    locationValidator = {
      validate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocationValidator>

    handler = new CreateEventHandler(writeRepo, locationValidator)
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, 'Ambato', null, null)

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

  it('should create event with valid province and canton', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, null, 18, 1)

    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(locationValidator.validate).toHaveBeenCalledWith(18, 1)
  })

  it('should propagate location validation errors', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, null, 999, null)

    locationValidator.validate.mockRejectedValue(
      AppException.businessRule('event.province_not_found'),
    )

    await expect(handler.execute(command)).rejects.toThrow('event.province_not_found')
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand('Test Event', new Date('2020-01-01'), null, null, null)

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
