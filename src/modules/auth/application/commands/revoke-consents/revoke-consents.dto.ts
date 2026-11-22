import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn } from 'class-validator'
import {
  CONSENT_TYPE,
  type ConsentType,
  REVOCABLE_CONSENT_TYPES,
} from '../../../domain/constants/consent.constants'

export class RevokeConsentsDto {
  @ApiProperty({
    description:
      'Consent types the current user withdraws. Only optional consents can be withdrawn',
    isArray: true,
    enum: REVOCABLE_CONSENT_TYPES,
    example: [CONSENT_TYPE.COMMUNITY_EMAILS],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(REVOCABLE_CONSENT_TYPES.length)
  @IsIn(REVOCABLE_CONSENT_TYPES, { each: true })
  types: ConsentType[]
}
