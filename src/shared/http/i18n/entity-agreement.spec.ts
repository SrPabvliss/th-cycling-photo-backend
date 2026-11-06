import type { I18nContext } from 'nestjs-i18n'
import { agreeingMessageKey, translateEntity } from './entity-agreement'

const i18nWith = (entries: Record<string, string>) =>
  ({ t: (key: string) => entries[key] ?? key }) as unknown as I18nContext

describe('entity agreement', () => {
  const es = i18nWith({
    'entities.order': 'Orden',
    'entities.photo_category': 'Categoría de fotos',
    'entities.event': 'Evento',
    'entity_gender.order': 'f',
    'entity_gender.stats': 'fp',
    'success.UPDATED_F': '{entity} actualizada exitosamente',
    'success.FETCHED_FP': '{entity} obtenidas exitosamente',
  })

  it('picks the feminine variant for a feminine entity', () => {
    expect(agreeingMessageKey(es, 'success.UPDATED', 'entities.order')).toBe('success.UPDATED_F')
  })

  it('picks the feminine plural variant', () => {
    expect(agreeingMessageKey(es, 'success.FETCHED', 'entities.stats')).toBe('success.FETCHED_FP')
  })

  it('keeps the base key for a masculine entity', () => {
    expect(agreeingMessageKey(es, 'success.UPDATED', 'entities.event')).toBe('success.UPDATED')
  })

  it('keeps the base key when the language has no variant', () => {
    expect(agreeingMessageKey(es, 'success.DELETED', 'entities.order')).toBe('success.DELETED')
  })

  it('translates a raw class-like entity name through the entities namespace', () => {
    expect(translateEntity(es, 'Event')).toBe('Evento')
    expect(translateEntity(es, 'PhotoCategory')).toBe('Categoría de fotos')
    expect(translateEntity(es, 'entities.order')).toBe('Orden')
  })

  it('leaves an unknown entity untouched', () => {
    expect(translateEntity(es, 'Widget')).toBe('Widget')
  })
})
