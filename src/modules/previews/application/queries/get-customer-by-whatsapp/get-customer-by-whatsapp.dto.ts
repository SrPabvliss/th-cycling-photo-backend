import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GetCustomerByWhatsAppDto {
  @ApiProperty({ description: 'WhatsApp number to search', example: '+593987654321' })
  @IsString()
  @IsNotEmpty()
  whatsapp: string
}
