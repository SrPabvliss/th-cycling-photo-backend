import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

export class UpdateTenantQuotaDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  quota: number
}
