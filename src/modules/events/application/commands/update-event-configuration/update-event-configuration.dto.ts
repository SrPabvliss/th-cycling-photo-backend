import { EventPayoutSelectionDto } from '@events/application/commands/create-event/create-event.dto'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { MAX_PUBLIC_NAME_LENGTH, MIN_PUBLIC_NAME_LENGTH } from '@shared/constants/payout.constants'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class UpdateEventConfigurationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_PUBLIC_NAME_LENGTH)
  @MaxLength(MAX_PUBLIC_NAME_LENGTH)
  @IsOptional()
  publicName?: string | null

  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsString()
  @MaxLength(500)
  @IsOptional()
  watermarkStorageKey?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  whatsappNumber?: string | null

  @ApiPropertyOptional({ type: [EventPayoutSelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPayoutSelectionDto)
  @IsOptional()
  payoutMethods?: EventPayoutSelectionDto[]
}
