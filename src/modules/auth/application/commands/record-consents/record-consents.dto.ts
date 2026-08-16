import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn } from 'class-validator'
import { CONSENT_TYPE, type ConsentType } from '../../../domain/constants/consent.constants'

const ALLOWED_TYPES = Object.values(CONSENT_TYPE)

export class RecordConsentsDto {
  @ApiProperty({
    description: 'Consent types accepted by the current user',
    isArray: true,
    enum: ALLOWED_TYPES,
    example: [CONSENT_TYPE.TERMS_PRIVACY],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(ALLOWED_TYPES.length)
  @IsIn(ALLOWED_TYPES, { each: true })
  types: ConsentType[]
}
