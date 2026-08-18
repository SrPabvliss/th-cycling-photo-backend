import { MODULE_METADATA } from '@nestjs/common/constants'
import { APP_GUARD } from '@nestjs/core'
import { AppModule } from './app.module'
import { PermissionGuard } from './shared/authorization/infrastructure/guards/permission.guard'

/**
 * `PermissionGuard`'s own unit tests instantiate it directly, and
 * `route-classification.spec.ts` only reads decorator metadata off
 * routes — neither one would notice if the guard were quietly removed
 * from `AppModule`'s actual `APP_GUARD` chain, which is the one place
 * that decides whether it runs on a real request at all. Deleting that
 * one provider entry would open every route in the product while the
 * rest of the suite stayed green.
 *
 * This reads the `providers` array directly off `AppModule`'s own
 * `@Module()` metadata via `Reflect.getMetadata` — no `TestingModule`
 * compile, no app boot, no Postgres/Redis dependency.
 * `route-classification.spec.ts` already pays the cost of a full
 * `AppModule` boot once; this does not need to pay it again.
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
