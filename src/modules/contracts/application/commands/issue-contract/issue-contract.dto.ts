import { ApiProperty } from '@nestjs/swagger'
import { endOfDayInEcuador } from '@shared/domain'
import { NormalizeEmail } from '@shared/http/decorators/normalize-email.decorator'
import { Transform } from 'class-transformer'
import { IsDate, IsEmail, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator'

export class IssueContractDto {
  @ApiProperty({ description: "Owner's email address", example: 'organizador@example.com' })
  @NormalizeEmail()
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
  // Reads the raw `obj[key]`: the global pipe's implicit conversion has already turned `value` into
  // UTC midnight by the time a custom transform runs, which lands on the previous day in Ecuador.
  @Transform(({ obj, key }) =>
    typeof obj[key] === 'string' ? endOfDayInEcuador(obj[key]) : obj[key],
  )
  @IsDate()
  validUntil: Date
}
