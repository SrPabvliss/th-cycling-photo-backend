import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { MetadataScanner, Reflector } from '@nestjs/core'
import { AppModule } from '../../app.module'
import { IS_PUBLIC_KEY } from '../auth'
import { IS_AUTHENTICATED_KEY } from './presentation/decorators/authenticated.decorator'
import { PERMISSION_KEY } from './presentation/decorators/require-permission.decorator'

// biome-ignore lint/suspicious/noExplicitAny: module classes are heterogeneous constructor functions
type ModuleClass = new (...args: any[]) => unknown
type ForwardReference = { forwardRef: () => unknown }
type DynamicModuleLike = { module: ModuleClass; imports?: unknown[]; controllers?: ModuleClass[] }

const isForwardReference = (x: unknown): x is ForwardReference =>
  typeof x === 'object' && x !== null && typeof (x as ForwardReference).forwardRef === 'function'

const isDynamicModule = (x: unknown): x is DynamicModuleLike =>
  typeof x === 'object' && x !== null && 'module' in x

/**
 * Statically walks the module graph reachable from `AppModule` — the exact
 * traversal Nest's own bootstrap performs to register routes — collecting
 * every controller class along the way. It reads each module's `@Module()`
 * decorator metadata directly via `Reflect.getMetadata` (the same technique
 * `app.module.spec.ts` uses for `AppModule` itself) instead of compiling a
 * `TestingModule` and calling `app.init()`.
 *
 * No provider is ever instantiated — `imports: [BullModule.forRootAsync(...)]`
 * and friends are only ever read as inert `DynamicModule` descriptor objects,
 * never resolved through Nest's DI container — so this needs no Postgres, no
 * Redis, and no `AppModule` boot at all. `forwardRef(() => X)` entries (used
 * throughout the module graph to break circular imports, e.g.
 * `PhotosModule` <-> `EventsModule`) are unwrapped the same way Nest itself
 * unwraps them.
 */
function collectControllers(): Set<ModuleClass> {
  const controllers = new Set<ModuleClass>()
  const visited = new Set<ModuleClass>()
  const queue: unknown[] = [AppModule]

  while (queue.length > 0) {
    let entry = queue.shift()
    if (isForwardReference(entry)) entry = entry.forwardRef()

    let moduleClass: ModuleClass
    let inlineImports: unknown[] = []
    let inlineControllers: ModuleClass[] = []

    if (typeof entry === 'function') {
      moduleClass = entry as ModuleClass
    } else if (isDynamicModule(entry)) {
      moduleClass = entry.module
      inlineImports = entry.imports ?? []
      inlineControllers = entry.controllers ?? []
    } else {
      // Not a module reference (e.g. a provider token) — nothing reachable
      // from AppModule's own import graph takes this shape, but skip rather
      // than throw so an unexpected shape doesn't crash the whole census.
      continue
    }

    if (visited.has(moduleClass)) continue
    visited.add(moduleClass)

    const staticImports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? []
    const staticControllers: ModuleClass[] =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleClass) ?? []

    for (const controller of [...staticControllers, ...inlineControllers]) {
      controllers.add(controller)
    }
    queue.push(...staticImports, ...inlineImports)
  }

  return controllers
}

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
 * Discovery approach: a static module-graph walk (see `collectControllers`
 * above) rather than walking Express's router stack. The Express handler
 * Nest registers per route only carries metadata set directly on the
 * controller *method* — a marker applied at the *class* level (e.g.
 * `AppController`'s `@Public()`) never reaches it, which produces a false
 * "unclassified" positive for an already-correctly-classified route.
 * `PermissionGuard` itself resolves markers via
 * `reflector.getAllAndOverride(key, [handler, class])` (checking both), so
 * this test mirrors that exactly by reading metadata off the controller
 * class and its prototype method directly, which is accurate for both
 * placements.
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
 * today) makes that failure mode loud instead of invisible. The same logic
 * applies to `MODULE_METADATA` in `collectControllers`: if it silently
 * resolved to `undefined`, every module's imports/controllers would read as
 * empty, `collectControllers` would return nothing, `totalRoutes` would stay
 * at 0, and this floor would still catch it.
 */
describe('route classification', () => {
  it('every route carries exactly one authorization marker', () => {
    const reflector = new Reflector()
    const scanner = new MetadataScanner()
    const unclassified: string[] = []
    let totalRoutes = 0

    for (const controller of collectControllers()) {
      const prototype = controller.prototype

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        // biome-ignore lint/suspicious/noExplicitAny: reading a controller's own prototype method by name
        const handler = (prototype as any)[methodName]

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler)
        if (httpMethod === undefined) continue // not an HTTP route handler
        totalRoutes++

        const targets = [handler, controller]
        const markers = [PERMISSION_KEY, IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY].filter(
          (k) => reflector.getAllAndOverride(k, targets) !== undefined,
        )

        if (markers.length !== 1) {
          const subPath: string = Reflect.getMetadata(PATH_METADATA, handler) ?? ''
          const verb = RequestMethod[httpMethod] ?? httpMethod
          unclassified.push(
            `${controller.name}.${methodName} [${verb} ${subPath}] (${markers.length} markers)`,
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
