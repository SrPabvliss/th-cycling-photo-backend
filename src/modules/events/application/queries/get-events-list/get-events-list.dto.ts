import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetEventsListDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number
}
