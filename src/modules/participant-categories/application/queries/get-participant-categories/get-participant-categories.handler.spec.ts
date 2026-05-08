import { Test, type TestingModule } from '@nestjs/testing'
import {
  type IParticipantCategoryReadRepository,
  PARTICIPANT_CATEGORY_READ_REPOSITORY,
} from '../../../domain/ports'
import { GetParticipantCategoriesHandler } from './get-participant-categories.handler'
import { GetParticipantCategoriesQuery } from './get-participant-categories.query'

describe('GetParticipantCategoriesHandler', () => {
  let handler: GetParticipantCategoriesHandler
  let readRepo: jest.Mocked<IParticipantCategoryReadRepository>

  beforeEach(async () => {
    readRepo = {
      findByEventType: jest.fn(),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GetParticipantCategoriesHandler,
        { provide: PARTICIPANT_CATEGORY_READ_REPOSITORY, useValue: readRepo },
      ],
    }).compile()

    handler = moduleRef.get(GetParticipantCategoriesHandler)
  })

  it('delegates to readRepo.findByEventType with the query event type id', async () => {
    const fixtures = [
      { id: 1, name: 'Elite' },
      { id: 2, name: 'Sub-23' },
    ]
    readRepo.findByEventType.mockResolvedValue(fixtures)

    const result = await handler.execute(new GetParticipantCategoriesQuery(7))

    expect(readRepo.findByEventType).toHaveBeenCalledWith(7)
    expect(result).toBe(fixtures)
  })

  it('propagates an empty list', async () => {
    readRepo.findByEventType.mockResolvedValue([])
    const result = await handler.execute(new GetParticipantCategoriesQuery(99))
    expect(result).toEqual([])
  })
})
