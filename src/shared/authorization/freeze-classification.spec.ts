import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { MetadataScanner, Reflector } from '@nestjs/core'
import { AppModule } from '../../app.module'
import { PERMISSIONS, type PermissionKey } from './domain/permission-catalog'
import {
  ALLOWED_WHEN_FROZEN_KEY,
  BLOCKS_WHEN_FROZEN_KEY,
} from './presentation/decorators/freeze-policy.decorator'
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

describe('freeze classification', () => {
  it('every event-scoped mutation route declares a freeze policy', () => {
    const reflector = new Reflector()
    const scanner = new MetadataScanner()
    const unclassified: string[] = []
    let totalMutations = 0

    const MUTATION_METHODS = [
      RequestMethod.POST,
      RequestMethod.PATCH,
      RequestMethod.PUT,
      RequestMethod.DELETE,
    ]

    for (const controller of collectControllers()) {
      const prototype = controller.prototype

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        // biome-ignore lint/suspicious/noExplicitAny: reading a controller's own prototype method by name
        const handler = (prototype as any)[methodName]

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler)
        if (httpMethod === undefined) continue
        if (!MUTATION_METHODS.includes(httpMethod)) continue

        const targets = [handler, controller]
        const permission = reflector.getAllAndOverride(PERMISSION_KEY, targets)
        if (permission === undefined) continue

        const meta = PERMISSIONS[permission as PermissionKey]
        if (!meta?.eventScope) continue
        totalMutations++

        const markers = [BLOCKS_WHEN_FROZEN_KEY, ALLOWED_WHEN_FROZEN_KEY].filter(
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

    expect(totalMutations).toBeGreaterThan(25)
    expect(unclassified).toEqual([])
  })
})
