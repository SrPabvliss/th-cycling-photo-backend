import type {
  ConfigurationSelection,
  EventPayoutSelection,
} from '@events/application/services/event-configuration.service'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ACCOUNT_NUMBER_PATTERN,
  ACCOUNT_TYPES,
  HOLDER_IDENTIFICATION_PATTERN,
  MAX_ACCOUNT_HOLDER_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
  MAX_ACCOUNT_TYPE_LENGTH,
  MAX_BANK_NAME_LENGTH,
  MAX_HOLDER_IDENTIFICATION_LENGTH,
  MAX_PUBLIC_NAME_LENGTH,
  MIN_ACCOUNT_HOLDER_LENGTH,
  MIN_BANK_NAME_LENGTH,
  MIN_PUBLIC_NAME_LENGTH,
  normalizeAccountType,
} from '@shared/constants/payout.constants'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class EventPayoutSelectionDto {
  @ApiProperty({ enum: ['profile', 'event', 'new'] })
  @IsIn(['profile', 'event', 'new'])
  source: 'profile' | 'event' | 'new'

  @ApiPropertyOptional()
  @ValidateIf((dto: EventPayoutSelectionDto) => dto.source === 'profile' || dto.source === 'event')
  @IsUUID('4')
  id?: string

  @ApiPropertyOptional({ enum: ['payphone', 'bank_transfer'] })
  @ValidateIf((dto: EventPayoutSelectionDto) => dto.source === 'new')
  @IsIn(['payphone', 'bank_transfer'])
  provider?: 'payphone' | 'bank_transfer'

  @ApiPropertyOptional()
  @ValidateIf((dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'payphone')
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phone?: string

  @ApiPropertyOptional({ example: 'Banco Pichincha' })
  @ValidateIf(
    (dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'bank_transfer',
  )
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_BANK_NAME_LENGTH)
  @MaxLength(MAX_BANK_NAME_LENGTH)
  bankName?: string

  @ApiPropertyOptional({ example: '2100458899' })
  @ValidateIf(
    (dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'bank_transfer',
  )
  @IsString()
  @Matches(ACCOUNT_NUMBER_PATTERN)
  @MaxLength(MAX_ACCOUNT_NUMBER_LENGTH)
  accountNumber?: string

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES })
  @ValidateIf(
    (dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'bank_transfer',
  )
  @Transform(({ value }: { value: unknown }) => normalizeAccountType(value))
  @IsIn(ACCOUNT_TYPES)
  @MaxLength(MAX_ACCOUNT_TYPE_LENGTH)
  accountType?: string

  @ApiPropertyOptional({ example: 'Andres Cepeda Mora' })
  @ValidateIf(
    (dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'bank_transfer',
  )
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_ACCOUNT_HOLDER_LENGTH)
  @MaxLength(MAX_ACCOUNT_HOLDER_LENGTH)
  accountHolder?: string

  @ApiPropertyOptional({ example: '1712345678' })
  @ValidateIf(
    (dto: EventPayoutSelectionDto) => dto.source === 'new' && dto.provider === 'bank_transfer',
  )
  @IsString()
  @Matches(HOLDER_IDENTIFICATION_PATTERN)
  @MaxLength(MAX_HOLDER_IDENTIFICATION_LENGTH)
  holderIdentification?: string
}

export class EventConfigurationSelectionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_PUBLIC_NAME_LENGTH)
  @MaxLength(MAX_PUBLIC_NAME_LENGTH)
  @IsOptional()
  publicName?: string | null

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((_, v) => v !== undefined)
  watermarkStorageKey?: string

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

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the cycling event', example: 'Vuelta al Cotopaxi 2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @ApiProperty({
    description: 'First day of the event (inclusive). May be in the past.',
    example: '2026-06-15T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date

  @ApiProperty({
    description: 'Last day of the event (inclusive). Must be >= startDate.',
    example: '2026-06-17T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date

  @ApiPropertyOptional({ description: 'Province ID where the event takes place', example: 18 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  provinceId?: number

  @ApiPropertyOptional({
    description: 'Canton ID where the event takes place. Optional even when provinceId is set.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  cantonId?: number

  @ApiProperty({ description: 'Event type ID', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventTypeId: number

  @ApiPropertyOptional({ type: EventConfigurationSelectionDto })
  @ValidateNested()
  @Type(() => EventConfigurationSelectionDto)
  @IsOptional()
  configuration?: EventConfigurationSelectionDto
}

export interface ConfigurationSelectionDtoLike {
  publicName?: string | null
  watermarkStorageKey?: string
  whatsappNumber?: string | null
  payoutMethods?: EventPayoutSelectionDto[]
}

export const toEventPayoutSelection = (dto: EventPayoutSelectionDto): EventPayoutSelection =>
  dto.source === 'profile'
    ? { source: 'profile', id: dto.id as string }
    : dto.source === 'event'
      ? { source: 'event', id: dto.id as string }
      : dto.provider === 'payphone'
        ? { source: 'new', provider: 'payphone', phone: dto.phone as string }
        : {
            source: 'new',
            provider: 'bank_transfer',
            bankName: dto.bankName as string,
            accountNumber: dto.accountNumber as string,
            accountType: dto.accountType as string,
            accountHolder: dto.accountHolder as string,
            holderIdentification: dto.holderIdentification as string,
          }

export const toConfigurationSelection = (
  dto: ConfigurationSelectionDtoLike,
): ConfigurationSelection => ({
  publicName: dto.publicName,
  watermarkStorageKey: dto.watermarkStorageKey,
  whatsappNumber: dto.whatsappNumber,
  payoutMethods: dto.payoutMethods?.map(toEventPayoutSelection),
})
