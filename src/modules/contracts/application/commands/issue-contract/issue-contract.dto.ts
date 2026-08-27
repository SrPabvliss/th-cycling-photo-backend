import { ApiProperty } from '@nestjs/swagger'
import { endOfDayInEcuador } from '@shared/domain'
import { Transform } from 'class-transformer'
import { IsDate, IsEmail, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator'

export class IssueContractDto {
  @ApiProperty({ description: "Owner's email address", example: 'organizador@example.com' })
  @IsEmail()
  @MaxLength(255)
  ownerEmail: string

  @ApiProperty({ description: 'Commercial name of the tenant', example: 'Vuelta Ambato' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  commercialName: string

  @ApiProperty({ description: 'Number of events the contract grants', example: 1 })
  @IsInt()
  @Min(1)
  eventsTotal: number

  @ApiProperty({ description: 'Number of photos allowed per event', example: 600 })
  @IsInt()
  @Min(1)
  photosPerEvent: number

  @ApiProperty({
    description: 'Last day (Ecuador time) the contract stays usable, as yyyy-MM-dd',
    example: '2026-12-31',
  })
  @Transform(({ value }) => (typeof value === 'string' ? endOfDayInEcuador(value) : value))
  @IsDate()
  validUntil: Date
}
