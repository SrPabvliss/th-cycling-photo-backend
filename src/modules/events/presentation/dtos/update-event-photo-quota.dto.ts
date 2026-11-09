import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min, ValidateIf } from 'class-validator'

export class UpdateEventPhotoQuotaDto {
  @ApiProperty({ example: 2000, nullable: true, required: true })
  // null means unlimited and must stay valid; a missing field must still be rejected
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  quota: number | null
}
