import { ProcessingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { ProcessingStatusVo } from './processing-status.vo'

describe('ProcessingStatusVo', () => {
  it('builds running / completed / failed factories', () => {
    expect(ProcessingStatusVo.running().value).toBe(ProcessingStatus.running)
    expect(ProcessingStatusVo.completed().value).toBe(ProcessingStatus.completed)
    expect(ProcessingStatusVo.failed().value).toBe(ProcessingStatus.failed)
  })
  it('parses valid value', () => {
    expect(ProcessingStatusVo.fromValue('running').value).toBe(ProcessingStatus.running)
  })
  it('rejects invalid value', () => {
    expect(() => ProcessingStatusVo.fromValue('xxx')).toThrow(AppException)
  })
})
