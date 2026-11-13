import {
  GetPublicEventDetailQuery,
  GetPublicEventFiltersQuery,
  GetPublicEventsListQuery,
} from '@events/application/queries'
import { type INestApplication, ValidationPipe } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PublicEventsController } from './public-events.controller'

describe('PublicEventsController routes', () => {
  let app: INestApplication
  const queryBus = { execute: jest.fn() }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicEventsController],
      providers: [{ provide: QueryBus, useValue: queryBus }],
    }).compile()

    app = module.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    queryBus.execute.mockReset().mockResolvedValue({})
  })

  it('sends no filters when the request carries none', async () => {
    await request(app.getHttpServer()).get('/public/events').expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query).toBeInstanceOf(GetPublicEventsListQuery)
    expect(query.filters).toEqual({ search: null, eventTypeId: null, hasPhotos: false })
    expect(query.pagination.page).toBe(1)
    expect(query.pagination.limit).toBe(20)
  })

  it('passes search, eventTypeId and hasPhotos through to the query', async () => {
    await request(app.getHttpServer())
      .get('/public/events')
      .query({ search: ' Cañar ', eventTypeId: '4', hasPhotos: 'true', page: '2', limit: '10' })
      .expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query.filters).toEqual({ search: 'Cañar', eventTypeId: 4, hasPhotos: true })
    expect(query.pagination.page).toBe(2)
  })

  it('does not turn hasPhotos=false into a filter', async () => {
    await request(app.getHttpServer()).get('/public/events').query({ hasPhotos: 'false' })

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query.filters.hasPhotos).toBe(false)
  })

  it('answers 400 to a one-character search without reaching the query bus', async () => {
    await request(app.getHttpServer()).get('/public/events').query({ search: 'a' }).expect(400)

    expect(queryBus.execute).not.toHaveBeenCalled()
  })

  it('routes /public/events/filters to the filters query, not to an event slug', async () => {
    await request(app.getHttpServer()).get('/public/events/filters').expect(200)

    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetPublicEventFiltersQuery)
  })

  it('still routes any other segment to the event detail', async () => {
    await request(app.getHttpServer()).get('/public/events/vuelta-al-cotopaxi').expect(200)

    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetPublicEventDetailQuery)
  })
})
