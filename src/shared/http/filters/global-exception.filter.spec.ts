import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import { I18nContext } from 'nestjs-i18n'
import { AppException, ErrorCode } from '../../domain/exceptions/app.exception'
import { GlobalExceptionFilter } from './global-exception.filter'

jest.mock('nestjs-i18n', () => ({
  I18nContext: {
    current: jest.fn(),
  },
}))

const mockJson = jest.fn()
const mockStatus = jest.fn().mockReturnValue({ json: mockJson })

const mockResponse = { status: mockStatus } as any
const mockRequest = {
  method: 'GET',
  url: '/api/v1/events',
  requestId: 'test-request-id',
} as any

const mockHost = {
  switchToHttp: () => ({
    getRequest: () => mockRequest,
    getResponse: () => mockResponse,
  }),
} as any

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter

  beforeEach(() => {
    filter = new GlobalExceptionFilter()
    jest.clearAllMocks()
    ;(I18nContext.current as jest.Mock).mockReturnValue(undefined)
    process.env.NODE_ENV = 'test'
  })

  describe('AppException handling', () => {
    it('should format AppException with correct ADR-002 structure', () => {
      const exception = AppException.notFound('event', '123')

      filter.catch(exception, mockHost)

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'errors.NOT_FOUND',
          shouldThrow: false,
        },
        meta: {
          requestId: 'test-request-id',
          timestamp: expect.any(String),
          path: '/api/v1/events',
        },
      })
    })

    it('should include fields for validation exceptions', () => {
      const fields = { name: ['Name is required'] }
      const exception = AppException.validationFailed(fields)

      filter.catch(exception, mockHost)

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      const body = mockJson.mock.calls[0][0]
      expect(body.error.fields).toEqual(fields)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    })

    it('should include details and stack in development mode', () => {
      process.env.NODE_ENV = 'development'
      const exception = AppException.notFound('event', '123')

      filter.catch(exception, mockHost)

      const body = mockJson.mock.calls[0][0]
      expect(body.error.details).toEqual({ entity: 'event', id: '123' })
      expect(body.error.stack).toBeDefined()
    })

    it('should NOT include details and stack in production mode', () => {
      process.env.NODE_ENV = 'production'
      const exception = AppException.notFound('event', '123')

      filter.catch(exception, mockHost)

      const body = mockJson.mock.calls[0][0]
      expect(body.error.details).toBeUndefined()
      expect(body.error.stack).toBeUndefined()
    })

    it('should translate messages when i18n is available', () => {
      const mockI18n = { t: jest.fn().mockReturnValue('Evento no encontrado') }
      ;(I18nContext.current as jest.Mock).mockReturnValue(mockI18n)

      const exception = AppException.notFound('event', '123')
      filter.catch(exception, mockHost)

      expect(mockI18n.t).toHaveBeenCalledWith('errors.NOT_FOUND', {
        args: { entity: 'event', id: '123' },
      })
      const body = mockJson.mock.calls[0][0]
      expect(body.error.message).toBe('Evento no encontrado')
    })
  })

  describe('HttpException handling (class-validator)', () => {
    it('should extract validation fields from BadRequestException', () => {
      const exception = new BadRequestException({
        message: ['name must be a string', 'name should not be empty', 'date must be a Date'],
        error: 'Bad Request',
        statusCode: 400,
      })

      filter.catch(exception, mockHost)

      expect(mockStatus).toHaveBeenCalledWith(400)
      const body = mockJson.mock.calls[0][0]
      expect(body.error.code).toBe('VALIDATION_FAILED')
      expect(body.error.fields).toEqual({
        name: ['name must be a string', 'name should not be empty'],
        date: ['date must be a Date'],
      })
    })

    it('should handle HttpException without validation fields', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN)

      filter.catch(exception, mockHost)

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN)
      const body = mockJson.mock.calls[0][0]
      expect(body.error.code).toBe('INTERNAL')
      expect(body.error.fields).toBeUndefined()
    })
  })

  describe('Unknown exception handling', () => {
    it('should handle unknown Error with 500 status', () => {
      const exception = new Error('Something went wrong')

      filter.catch(exception, mockHost)

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      const body = mockJson.mock.calls[0][0]
      expect(body.error.code).toBe('INTERNAL')
      expect(body.error.message).toBe('An unexpected error occurred')
      expect(body.error.shouldThrow).toBe(false)
    })

    it('should handle non-Error exceptions', () => {
      filter.catch('string exception', mockHost)

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      const body = mockJson.mock.calls[0][0]
      expect(body.error.code).toBe('INTERNAL')
    })

    it('should include error details in development for unknown errors', () => {
      process.env.NODE_ENV = 'development'
      const exception = new Error('DB connection failed')

      filter.catch(exception, mockHost)

      const body = mockJson.mock.calls[0][0]
      expect(body.error.details).toBe('DB connection failed')
      expect(body.error.stack).toBeDefined()
    })
  })

  describe('meta information', () => {
    it('should always include requestId, timestamp, and path', () => {
      filter.catch(new Error('test'), mockHost)

      const body = mockJson.mock.calls[0][0]
      expect(body.meta.requestId).toBe('test-request-id')
      expect(body.meta.timestamp).toBeDefined()
      expect(body.meta.path).toBe('/api/v1/events')
    })
  })
})
