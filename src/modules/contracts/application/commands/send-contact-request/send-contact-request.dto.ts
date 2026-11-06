import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import type { ContactReason } from './send-contact-request.command'

export const CONTACT_REASONS: ContactReason[] = ['more_quota', 'renewal']

export class SendContactRequestDto {
  @ApiProperty({ enum: CONTACT_REASONS })
  @IsIn(CONTACT_REASONS)
  reason: ContactReason

  @ApiPropertyOptional({ minimum: 1, maximum: 100, nullable: true })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  eventsWanted?: number | null

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string
}
