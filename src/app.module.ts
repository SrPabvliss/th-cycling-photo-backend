import * as path from 'node:path'
import { BullModule } from '@nestjs/bullmq'
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import configuration from './config/configuration'
import { validate } from './config/env.validation'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/infrastructure/guards/jwt-auth.guard'
import { ClassificationsModule } from './modules/classifications/classifications.module'
import { CustomersModule } from './modules/customers/customers.module'
import { DeliveriesModule } from './modules/deliveries/deliveries.module'
import { EventAssetsModule } from './modules/event-assets/event-assets.module'
import { EventsModule } from './modules/events/events.module'
import { LocationsModule } from './modules/locations/locations.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OrdersModule } from './modules/orders/orders.module'
import { PhotosModule } from './modules/photos/photos.module'
import { PreviewsModule } from './modules/previews/previews.module'
import { UsersModule } from './modules/users/users.module'
import { RolesGuard } from './shared/auth'
import { EmbeddingsModule } from './shared/embeddings/embeddings.module'
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
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6394),
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    StorageModule,
    NotificationsModule,
    EmbeddingsModule,
    ClassificationsModule,
    CustomersModule,
    DeliveriesModule,
    EventAssetsModule,
    EventsModule,
    LocationsModule,
    OrdersModule,
    PhotosModule,
    PreviewsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}')
  }
}
