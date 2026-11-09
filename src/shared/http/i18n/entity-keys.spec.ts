import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { I18nContext } from 'nestjs-i18n'
import { translateEntity } from './entity-agreement'

const SRC = join(__dirname, '..', '..', '..')
const NOT_FOUND_CALL = /AppException\.notFound\(\s*'([^']+)'/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path)
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : []
  })
}

function i18nFor(locale: string): I18nContext {
  const file = join(SRC, 'i18n', locale, 'entities.json')
  const entities = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
  // Brackets mark a hit, so an English name equal to its raw form ("Event") still counts as found.
  return {
    t: (key: string) => {
      const value = key.startsWith('entities.')
        ? entities[key.slice('entities.'.length)]
        : undefined
      return value === undefined ? key : `[${value}]`
    },
  } as unknown as I18nContext
}

const entitiesUsedByNotFound = [
  ...new Set(
    sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(NOT_FOUND_CALL)].map((match) => match[1]),
    ),
  ),
].sort()

describe('entity names passed to AppException.notFound', () => {
  it('finds the calls it guards', () => {
    expect(entitiesUsedByNotFound.length).toBeGreaterThan(10)
  })

  it.each([
    'es',
    'en',
  ])('all resolve to a translated name in %s, so none reaches the user raw', (locale) => {
    const i18n = i18nFor(locale)
    const untranslated = entitiesUsedByNotFound.filter(
      (entity) => !translateEntity(i18n, entity).startsWith('['),
    )
    expect(untranslated).toEqual([])
  })
})
