import { ApiProperty } from '@nestjs/swagger'

export class TenantListResponse {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  eventQuota: number

  @ApiProperty()
  eventsUsed: number

  @ApiProperty()
  createdAt: Date
}
