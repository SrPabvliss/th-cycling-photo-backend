import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  const port = configService.get<number>('port', 3000)
  const nodeEnv = configService.get<string>('nodeEnv')

  await app.listen(port)

  const logger = new Logger('Bootstrap')
  logger.log(`Application running on port ${port} [${nodeEnv}]`)
}
bootstrap()
