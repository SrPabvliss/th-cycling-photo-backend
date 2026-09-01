import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_ROOT = join(__dirname, '..')
const LOCALES = ['es', 'en']

const THROW_SITE =
  /(?:businessRule|notFound|forbidden|conflict|unauthorized|badRequest)\(\s*'([a-z0-9_]+\.[a-z0-9_.]+)'/g
const DIRECT_THROW = /new AppException\(\s*'([a-z0-9_]+\.[a-z0-9_.]+)'/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    if (!path.endsWith('.ts') || path.includes('.spec.')) return []
    return [path]
  })
}

function usedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(file, 'utf8')
    for (const [, key] of source.matchAll(THROW_SITE)) keys.add(key)
    for (const [, key] of source.matchAll(DIRECT_THROW)) keys.add(key)
  }
  return keys
}

function translatedKeys(locale: string): Set<string> {
  const dir = join(__dirname, locale)
  const keys = new Set<string>()

  function walk(node: Record<string, unknown>, prefix: string) {
    for (const [key, value] of Object.entries(node)) {
      const path = `${prefix}.${key}`
      if (value !== null && typeof value === 'object') walk(value as Record<string, unknown>, path)
      else keys.add(path)
    }
  }

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(dir, file), 'utf8')), file.replace('.json', ''))
  }
  return keys
}

describe('translation coverage', () => {
  // An untranslated key does not fail loudly: nestjs-i18n returns the key itself,
  // so the buyer reads "user_phone.cannot_delete_last_phone" as the error message.
  const keys = [...usedKeys()].sort()

  for (const locale of LOCALES) {
    it(`translates every thrown error key in ${locale}`, () => {
      const available = translatedKeys(locale)
      expect(keys.filter((key) => !available.has(key))).toEqual([])
    })
  }
})
