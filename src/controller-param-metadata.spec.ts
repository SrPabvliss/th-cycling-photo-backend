import * as fs from 'node:fs'
import * as path from 'node:path'
import { PARAMTYPES_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum'

function findControllerFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findControllerFiles(entryPath))
    else if (entry.name.endsWith('.controller.ts')) files.push(entryPath)
  }
  return files
}

// `import type` erases a DTO at compile time, so Nest reflects `Object` for it and ValidationPipe
// silently applies no class-validator rules — this walks every controller to catch that regression.
describe('controller @Body/@Query/@Param metadata', () => {
  it('never reflects Object for a whole-value Body, Query or Param parameter', () => {
    const controllerFiles = findControllerFiles(__dirname)
    expect(controllerFiles.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of controllerFiles) {
      const controllerModule = require(file)
      for (const [exportName, exported] of Object.entries(controllerModule)) {
        if (typeof exported !== 'function' || !Reflect.getMetadata(PATH_METADATA, exported))
          continue
        const prototype = exported.prototype
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
          if (methodName === 'constructor') continue
          const routeArgs = Reflect.getMetadata(ROUTE_ARGS_METADATA, exported, methodName)
          if (!routeArgs) continue
          const paramTypes: unknown[] =
            Reflect.getMetadata(PARAMTYPES_METADATA, prototype, methodName) ?? []

          for (const [metaKey, metaValue] of Object.entries(
            routeArgs as Record<string, { data?: unknown }>,
          )) {
            const [routeParamType, index] = metaKey.split(':').map(Number)
            const isWholeValueParam =
              [RouteParamtypes.BODY, RouteParamtypes.QUERY, RouteParamtypes.PARAM].includes(
                routeParamType,
              ) && !metaValue?.data
            if (isWholeValueParam && paramTypes[index] === Object) {
              offenders.push(`${path.basename(file)}: ${exportName}.${methodName} (arg ${index})`)
            }
          }
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
