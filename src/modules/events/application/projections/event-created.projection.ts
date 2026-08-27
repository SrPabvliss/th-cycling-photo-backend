import { ApiProperty } from '@nestjs/swagger'

export class EventCreatedProjection {
  @ApiProperty() id: string
  @ApiProperty() slug: string
}
