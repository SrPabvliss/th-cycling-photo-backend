import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class ChangeOrderContactPhoneDto {
  @ApiProperty({ description: 'Phone number with country code', example: '+593991234567' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value))
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^\+\d+$/, { message: 'phoneNumber must start with + and hold only digits' })
  phoneNumber: string

  @ApiPropertyOptional({
    description: "Also make it the primary number of the buyer's account. True when omitted.",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  updateAccount?: boolean
}
