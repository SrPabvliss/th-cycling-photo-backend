import { MODULE_METADATA } from '@nestjs/common/constants'
import { APP_GUARD } from '@nestjs/core'
import { AppModule } from './app.module'
import { PermissionGuard } from './shared/authorization/infrastructure/guards/permission.guard'

/**
 * Nothing else notices if `PermissionGuard` leaves `AppModule`'s `APP_GUARD` chain — its own tests
 * instantiate it directly and `route-classification.spec.ts` only reads decorator metadata — yet
 * deleting that one provider entry opens every route in the product.
 *
 * Reads the `providers` array off `AppModule`'s `@Module()` metadata via `Reflect.getMetadata`, so
 * no `TestingModule` compile and no Postgres/Redis.
 */
describe('AppModule wiring', () => {
  it('registers PermissionGuard as an APP_GUARD provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as unknown[]

    const guardProvider = providers.find(
      (p): p is { provide: unknown; useClass: unknown } =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        'useClass' in p &&
        p.provide === APP_GUARD &&
        p.useClass === PermissionGuard,
    )

    expect(guardProvider).toBeDefined()
  })
})
