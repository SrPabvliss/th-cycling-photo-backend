import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateOrderFromPreviewDto {
  @ApiProperty({
    description: 'Photo IDs to order (must be subset of preview photos)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds: string[]

  @ApiProperty({ description: 'Customer first name', example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  firstName: string

  @ApiProperty({ description: 'Customer last name', example: 'Mendoza' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  lastName: string

  @ApiProperty({ description: 'Customer WhatsApp number', example: '+593987654321' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  whatsapp: string

  @ApiPropertyOptional({ description: 'Customer email', example: 'carlos@example.com' })
  @IsEmail()
  @IsOptional()
  @Type(() => String)
  email?: string

  @ApiPropertyOptional({
    description: 'Order notes',
    example: 'Quiero las fotos del segundo grupo',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string
}
