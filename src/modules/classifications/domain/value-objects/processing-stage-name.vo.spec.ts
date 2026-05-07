import { ProcessingStageName } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { ProcessingStageNameVo } from './processing-stage-name.vo'

describe('ProcessingStageNameVo', () => {
  it('parses valid values', () => {
    expect(ProcessingStageNameVo.fromValue('detection').value).toBe(ProcessingStageName.detection)
    expect(ProcessingStageNameVo.fromValue('ocr').value).toBe(ProcessingStageName.ocr)
    expect(ProcessingStageNameVo.fromValue('color').value).toBe(ProcessingStageName.color)
  })
  it('rejects invalid value', () => {
    expect(() => ProcessingStageNameVo.fromValue('xxx')).toThrow(AppException)
  })
})
