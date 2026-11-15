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

  const NO_FILTERS = { search: null, eventTypeIds: [], provinceIds: [], from: null, to: null }

  it('sends no filters when the request carries none', async () => {
    await request(app.getHttpServer()).get('/public/events').expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query).toBeInstanceOf(GetPublicEventsListQuery)
    expect(query.filters).toEqual(NO_FILTERS)
    expect(query.pagination.page).toBe(1)
    expect(query.pagination.limit).toBe(20)
  })

  it('passes search, id lists and month range through to the query', async () => {
    await request(app.getHttpServer())
      .get('/public/events')
      .query({
        search: ' Cañar ',
        eventTypeIds: '4,1',
        provinceIds: '18',
        from: '2025-12',
        to: '2026-02',
        page: '2',
        limit: '10',
      })
      .expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query.filters).toEqual({
      search: 'Cañar',
      eventTypeIds: [4, 1],
      provinceIds: [18],
      from: '2025-12',
      to: '2026-02',
    })
    expect(query.pagination.page).toBe(2)
    expect(query.pagination.limit).toBe(10)
  })

  it('closes a range given by one end on that same month', async () => {
    await request(app.getHttpServer()).get('/public/events').query({ to: '2026-07' }).expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventsListQuery
    expect(query.filters).toMatchObject({ from: '2026-07', to: '2026-07' })
  })

  it.each([
    ['a one-character search', { search: 'a' }],
    ['a repeated id', { eventTypeIds: '1,1' }],
    ['an id that is not a positive integer', { provinceIds: '0' }],
    ['month 13', { from: '2026-13' }],
    ['a to earlier than from', { from: '2026-08', to: '2026-06' }],
    ['the old hasPhotos filter', { hasPhotos: 'true' }],
    ['the old eventTypeId filter', { eventTypeId: '1' }],
  ])('answers 400 to %s without reaching the query bus', async (_, params) => {
    await request(app.getHttpServer()).get('/public/events').query(params).expect(400)

    expect(queryBus.execute).not.toHaveBeenCalled()
  })

  it('routes /public/events/filters to the filters query, not to an event slug', async () => {
    await request(app.getHttpServer()).get('/public/events/filters').expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventFiltersQuery
    expect(query).toBeInstanceOf(GetPublicEventFiltersQuery)
    expect(query.filters).toEqual(NO_FILTERS)
  })

  it('passes the same filters to the filters query', async () => {
    await request(app.getHttpServer())
      .get('/public/events/filters')
      .query({ search: 'ruta', eventTypeIds: '2', provinceIds: '3,7', from: '2026-06' })
      .expect(200)

    const query = queryBus.execute.mock.calls[0][0] as GetPublicEventFiltersQuery
    expect(query.filters).toEqual({
      search: 'ruta',
      eventTypeIds: [2],
      provinceIds: [3, 7],
      from: '2026-06',
      to: '2026-06',
    })
  })

  it.each([
    ['an invalid filter', { eventTypeIds: 'x' }],
    ['pagination, which only the list takes', { page: '1' }],
  ])('answers 400 on /filters to %s', async (_, params) => {
    await request(app.getHttpServer()).get('/public/events/filters').query(params).expect(400)

    expect(queryBus.execute).not.toHaveBeenCalled()
  })

  it('still routes any other segment to the event detail', async () => {
    await request(app.getHttpServer()).get('/public/events/vuelta-al-cotopaxi').expect(200)

    expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetPublicEventDetailQuery)
  })
})
