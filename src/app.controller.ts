import { Controller, Get } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI requires runtime import for emitDecoratorMetadata
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello()
  }
}
