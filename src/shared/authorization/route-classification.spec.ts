import { type INestApplication, RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../app.module'
import { IS_PUBLIC_KEY } from '../auth'
import { IS_AUTHENTICATED_KEY } from './presentation/decorators/authenticated.decorator'
import { PERMISSION_KEY } from './presentation/decorators/require-permission.decorator'

/**
 * Every route in the application must carry exactly one authorization
 * marker: `@Public()`, `@Authenticated()`, or `@RequirePermission(key)`.
 * A route with none — or, pathologically, more than one — is a bug: either
 * it is silently reachable by any authenticated user (today's state for 19
 * routes, 9 of which expose every event and photo on the platform to any
 * logged-in buyer), or its authorization intent is ambiguous.
 *
 * This test is EXPECTED TO FAIL when Task 8 lands: it lists every route
 * still missing a marker. Tasks 9-12 apply decorators until this passes.
 * Do not weaken this assertion to make it green early — the failing list
 * is the worklist.
 *
 * Discovery approach: `DiscoveryService` + `MetadataScanner` rather than
 * walking Express's router stack. The Express handler Nest registers per
 * route only carries metadata set directly on the controller *method* — a
 * marker applied at the *class* level (e.g. `AppController`'s `@Public()`)
 * never reaches it, which produces a false "unclassified" positive for an
 * already-correctly-classified route. `PermissionGuard` itself resolves
 * markers via `reflector.getAllAndOverride(key, [handler, class])`
 * (checking both), so this test mirrors that exactly by reading metadata
 * off the controller class and its prototype method directly, which is
 * accurate for both placements.
 */
describe('route classification', () => {
  let app: INestApplication
  let reflector: Reflector
  let discovery: DiscoveryService
  let scanner: MetadataScanner

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    reflector = app.get(Reflector)
    discovery = app.get(DiscoveryService)
    scanner = app.get(MetadataScanner)
  })

  afterAll(() => app?.close())

  it('every route carries exactly one authorization marker', () => {
    const unclassified: string[] = []

    for (const wrapper of discovery.getControllers()) {
      const { instance, metatype } = wrapper
      if (!instance || !metatype) continue

      const prototype = Object.getPrototypeOf(instance)

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        // biome-ignore lint/suspicious/noExplicitAny: reading a controller's own prototype method by name
        const handler = (prototype as any)[methodName]

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler)
        if (httpMethod === undefined) continue // not an HTTP route handler

        const targets = [handler, metatype]
        const markers = [PERMISSION_KEY, IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY].filter(
          (k) => reflector.getAllAndOverride(k, targets) !== undefined,
        )

        if (markers.length !== 1) {
          const subPath: string = Reflect.getMetadata(PATH_METADATA, handler) ?? ''
          const verb = RequestMethod[httpMethod] ?? httpMethod
          unclassified.push(
            `${metatype.name}.${methodName} [${verb} ${subPath}] (${markers.length} markers)`,
          )
        }
      }
    }

    expect(unclassified).toEqual([])
  })
})
