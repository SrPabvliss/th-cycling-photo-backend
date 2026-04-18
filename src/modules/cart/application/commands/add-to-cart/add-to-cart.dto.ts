import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class AddToCartDto {
  @ApiProperty({ description: 'Photo ID to add to the cart' })
  @IsUUID('4')
  photoId: string

  @ApiPropertyOptional({ description: 'Session ID for anonymous carts' })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  sessionId?: string
}
