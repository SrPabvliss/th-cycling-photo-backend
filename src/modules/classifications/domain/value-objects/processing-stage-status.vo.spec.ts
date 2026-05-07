import { ProcessingStageStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { ProcessingStageStatusVo } from './processing-stage-status.vo'

describe('ProcessingStageStatusVo', () => {
  it('parses valid values', () => {
    expect(ProcessingStageStatusVo.fromValue('ok').value).toBe(ProcessingStageStatus.ok)
    expect(ProcessingStageStatusVo.fromValue('partial').value).toBe(ProcessingStageStatus.partial)
    expect(ProcessingStageStatusVo.fromValue('skipped').value).toBe(ProcessingStageStatus.skipped)
    expect(ProcessingStageStatusVo.fromValue('failed').value).toBe(ProcessingStageStatus.failed)
  })
  it('rejects invalid value', () => {
    expect(() => ProcessingStageStatusVo.fromValue('xxx')).toThrow(AppException)
  })
})
