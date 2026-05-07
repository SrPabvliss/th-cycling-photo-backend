import { AttributeSource } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class AttributeSourceVo {
  private constructor(public readonly value: AttributeSource) {}

  static ai(): AttributeSourceVo {
    return new AttributeSourceVo(AttributeSource.ai)
  }
  static reviewer(): AttributeSourceVo {
    return new AttributeSourceVo(AttributeSource.reviewer)
  }

  static fromValue(v: string): AttributeSourceVo {
    if (!Object.values(AttributeSource).includes(v as AttributeSource)) {
      throw AppException.businessRule('attribute_source.invalid', false, { received: v })
    }
    return new AttributeSourceVo(v as AttributeSource)
  }
}
