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
 * Collects every controller reachable from `AppModule` by reading `@Module()` metadata with
 * `Reflect.getMetadata`, the same traversal Nest's bootstrap performs. No provider is instantiated,
 * so this needs no Postgres, no Redis and no `app.init()`. `forwardRef()` entries are unwrapped.
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
      // Not a module reference (e.g. a provider token) — skip rather than crash the census.
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
 * Every route must carry exactly one authorization marker: `@Public()`, `@Authenticated()` or
 * `@RequirePermission(key)`. None means it is silently reachable by any authenticated user; more
 * than one means its intent is ambiguous.
 *
 * Markers are read off the controller class and its prototype method rather than Express's router
 * stack, which only sees method-level metadata and so reports class-level `@Public()` as missing.
 * This mirrors `PermissionGuard`'s own `getAllAndOverride(key, [handler, class])`.
 *
 * Don't mix marker types across class and method level on one controller: the guard resolves by
 * marker *type*, not by specificity, so a class-level `@Public()` beats a method-level
 * `@RequirePermission()`. This test flags the mix, but as a 2-marker error rather than a clear one.
 *
 * `totalRoutes` guards against a vacuous pass: `METHOD_METADATA` and friends come from an internal
 * Nest path, and if an upgrade renames them every constant silently becomes `undefined` and this
 * test would pass while checking nothing.
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

    // Vacuous-pass floor (see docstring). 117 routes exist today; the floor sits well under that
    // so ordinary route churn doesn't need a bump, but broken discovery still trips it.
    expect(totalRoutes).toBeGreaterThan(100)

    expect(unclassified).toEqual([])
  })
})
