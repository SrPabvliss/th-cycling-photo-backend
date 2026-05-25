import { Test, type TestingModule } from '@nestjs/testing'
import { EVENT_TYPE_READ_REPOSITORY, type IEventTypeReadRepository } from '../../../domain/ports'
import { GetAllEventTypesHandler } from './get-all-event-types.handler'
import { GetAllEventTypesQuery } from './get-all-event-types.query'

describe('GetAllEventTypesHandler', () => {
  let handler: GetAllEventTypesHandler
  let readRepo: jest.Mocked<IEventTypeReadRepository>

  beforeEach(async () => {
    readRepo = {
      findAll: jest.fn(),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GetAllEventTypesHandler,
        { provide: EVENT_TYPE_READ_REPOSITORY, useValue: readRepo },
      ],
    }).compile()

    handler = moduleRef.get(GetAllEventTypesHandler)
  })

  it('delegates to readRepo.findAll', async () => {
    const fixtures = [
      { id: 1, name: 'Downhill' },
      { id: 2, name: 'Enduro' },
    ]
    readRepo.findAll.mockResolvedValue(fixtures)

    const result = await handler.execute(new GetAllEventTypesQuery())

    expect(readRepo.findAll).toHaveBeenCalledTimes(1)
    expect(result).toBe(fixtures)
  })

  it('propagates an empty list', async () => {
    readRepo.findAll.mockResolvedValue([])
    const result = await handler.execute(new GetAllEventTypesQuery())
    expect(result).toEqual([])
  })
})
