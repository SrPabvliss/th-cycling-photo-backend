import { ApiProperty } from '@nestjs/swagger'

export class OperatorRetouchEventProjection {
  @ApiProperty() id: string
  @ApiProperty() slug: string
  @ApiProperty() name: string
}
