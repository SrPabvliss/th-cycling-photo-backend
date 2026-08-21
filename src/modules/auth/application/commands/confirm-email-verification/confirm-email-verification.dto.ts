import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class ConfirmEmailVerificationDto {
  @ApiProperty({ description: '6-digit verification code', example: '482913' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code: string
}
