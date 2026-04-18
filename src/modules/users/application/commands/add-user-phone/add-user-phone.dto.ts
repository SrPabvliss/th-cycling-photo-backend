import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class AddUserPhoneDto {
  @ApiProperty({ description: 'Phone number', example: '+593999123456' })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phoneNumber: string

  @ApiPropertyOptional({ description: 'Label (e.g. Personal, Work)', example: 'Personal' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  label?: string

  @ApiPropertyOptional({ description: 'Whether this number has WhatsApp', example: true })
  @IsBoolean()
  @IsOptional()
  isWhatsapp?: boolean
}
