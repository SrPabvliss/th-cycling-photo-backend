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
 *
 * Do not mix marker types across class and method level on the same
 * controller. `PermissionGuard` resolves by *type* first — it checks
 * `IS_PUBLIC_KEY` everywhere (handler and class) before it ever looks at
 * `IS_AUTHENTICATED_KEY`, and only then `PERMISSION_KEY` — not by
 * *specificity* of where the marker sits. A class-level `@Public()` on a
 * controller wins over a method-level `@RequirePermission(key)` or
 * `@Authenticated()` inside it, even though the method-level marker reads
 * as more specific. This test catches the mix as a 2-marker error, but
 * getting there costs a debugging session; don't combine marker types on
 * one controller.
 *
 * `totalRoutes` guards against a vacuous pass: `METHOD_METADATA` /
 * `PATH_METADATA` are read from `@nestjs/common/constants`, an internal
 * (not `@publicApi`) path. If a future Nest upgrade moves or renames them,
 * the imports silently become `undefined`, every route fails the `httpMethod
 * === undefined` check below, `unclassified` stays empty, and this test
 * would pass while checking nothing — permanently and silently, for the one
 * gate protecting the entire authorization model. The floor (117 routes
 * today) makes that failure mode loud instead of invisible.
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
    let totalRoutes = 0

    for (const wrapper of discovery.getControllers()) {
      const { instance, metatype } = wrapper
      if (!instance || !metatype) continue

      const prototype = Object.getPrototypeOf(instance)

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        // biome-ignore lint/suspicious/noExplicitAny: reading a controller's own prototype method by name
        const handler = (prototype as any)[methodName]

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler)
        if (httpMethod === undefined) continue // not an HTTP route handler
        totalRoutes++

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

    // Guards against a vacuous pass — see the docstring above. 117 routes
    // exist today; the floor stays well under that so ordinary route
    // additions/removals don't require bumping it, while a discovery
    // mechanism that silently stopped finding routes (e.g. METHOD_METADATA
    // resolving to undefined after a Nest upgrade) still trips it.
    expect(totalRoutes).toBeGreaterThan(100)

    expect(unclassified).toEqual([])
  })
})
