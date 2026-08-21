import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsInt, IsNotEmpty, IsString, Min } from 'class-validator'

export class CreateTenantDto {
  @ApiProperty({ example: 'My Tenant' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  eventQuota: number

  @ApiProperty({ example: 'admin@tenant.com' })
  @IsEmail()
  adminEmail: string

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty()
  adminPassword: string

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  adminFirstName: string

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  adminLastName: string
}
