import * as path from 'node:path'
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import configuration from './config/configuration'
import { validate } from './config/env.validation'
import { EventsModule } from './modules/events/events.module'
import { RequestIdMiddleware } from './shared/http/middleware/request-id.middleware'
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module'
import { StorageModule } from './shared/storage/storage.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validate,
      load: [configuration],
      isGlobal: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
    PrismaModule,
    StorageModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}')
  }
}
