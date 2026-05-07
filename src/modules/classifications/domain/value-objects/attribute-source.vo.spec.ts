import { AttributeSource } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { AttributeSourceVo } from './attribute-source.vo'

describe('AttributeSourceVo', () => {
  it('builds ai / reviewer factories', () => {
    expect(AttributeSourceVo.ai().value).toBe(AttributeSource.ai)
    expect(AttributeSourceVo.reviewer().value).toBe(AttributeSource.reviewer)
  })
  it('parses valid value', () => {
    expect(AttributeSourceVo.fromValue('ai').value).toBe(AttributeSource.ai)
  })
  it('rejects invalid value', () => {
    expect(() => AttributeSourceVo.fromValue('xxx')).toThrow(AppException)
  })
})
