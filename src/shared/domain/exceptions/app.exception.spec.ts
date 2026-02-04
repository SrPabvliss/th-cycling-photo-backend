import { HttpStatus } from '@nestjs/common'
import { AppException, ErrorCode } from './app.exception'

describe('AppException', () => {
  describe('notFound', () => {
    it('should create a NOT_FOUND exception with entity context', () => {
      const exception = AppException.notFound('event', '123')

      expect(exception).toBeInstanceOf(AppException)
      expect(exception.httpStatus).toBe(HttpStatus.NOT_FOUND)
      expect(exception.code).toBe(ErrorCode.NOT_FOUND)
      expect(exception.messageKey).toBe('errors.NOT_FOUND')
      expect(exception.shouldThrow).toBe(false)
      expect(exception.context).toEqual({ entity: 'event', id: '123' })
    })
  })

  describe('validationFailed', () => {
    it('should create a VALIDATION_FAILED exception with fields', () => {
      const fields = {
        name: ['Name is required', 'Name must be at least 5 characters'],
        date: ['Date is required'],
      }

      const exception = AppException.validationFailed(fields)

      expect(exception.httpStatus).toBe(HttpStatus.BAD_REQUEST)
      expect(exception.code).toBe(ErrorCode.VALIDATION_FAILED)
      expect(exception.shouldThrow).toBe(false)
      expect(exception.fields).toEqual(fields)
    })
  })

  describe('businessRule', () => {
    it('should create a BUSINESS_RULE exception with shouldThrow=false by default', () => {
      const exception = AppException.businessRule('event.date_in_past')

      expect(exception.httpStatus).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(exception.code).toBe(ErrorCode.BUSINESS_RULE)
      expect(exception.messageKey).toBe('event.date_in_past')
      expect(exception.shouldThrow).toBe(false)
    })

    it('should create a BUSINESS_RULE exception with shouldThrow=true when specified', () => {
      const exception = AppException.businessRule('product.not_exists', true)

      expect(exception.shouldThrow).toBe(true)
    })
  })

  describe('externalService', () => {
    it('should create an EXTERNAL_SERVICE exception with service context', () => {
      const originalError = new Error('Connection timeout')
      const exception = AppException.externalService('Roboflow', originalError)

      expect(exception.httpStatus).toBe(HttpStatus.BAD_GATEWAY)
      expect(exception.code).toBe(ErrorCode.EXTERNAL_SERVICE)
      expect(exception.context).toEqual({
        service: 'Roboflow',
        originalError: 'Connection timeout',
      })
    })

    it('should handle missing originalError', () => {
      const exception = AppException.externalService('CloudVision')

      expect(exception.context).toEqual({
        service: 'CloudVision',
        originalError: undefined,
      })
    })
  })

  describe('internal', () => {
    it('should create an INTERNAL exception', () => {
      const exception = AppException.internal('Unexpected failure', { detail: 'stack overflow' })

      expect(exception.httpStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(exception.code).toBe(ErrorCode.INTERNAL)
      expect(exception.shouldThrow).toBe(false)
      expect(exception.context).toEqual({ detail: 'stack overflow' })
    })
  })

  describe('inheritance', () => {
    it('should be an instance of Error', () => {
      const exception = AppException.notFound('event', '1')
      expect(exception).toBeInstanceOf(Error)
    })

    it('should have the messageKey as the Error message', () => {
      const exception = AppException.businessRule('event.date_in_past')
      expect(exception.message).toBe('event.date_in_past')
    })
  })
})
