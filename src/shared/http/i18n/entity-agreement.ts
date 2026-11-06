import type { I18nContext } from 'nestjs-i18n'

const GENDER_SUFFIX: Record<string, string> = { f: 'F', fp: 'FP' }

const entityName = (entity: string): string =>
  entity.startsWith('entities.')
    ? entity.slice('entities.'.length)
    : entity.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

const lookup = (i18n: I18nContext, key: string): string | null => {
  const value = String(i18n.t(key))
  return value === key ? null : value
}

export const translateEntity = (i18n: I18nContext, entity: string): string =>
  lookup(i18n, `entities.${entityName(entity)}`) ?? entity

export const agreeingMessageKey = (
  i18n: I18nContext,
  messageKey: string,
  entity: string,
): string => {
  const gender = lookup(i18n, `entity_gender.${entityName(entity)}`)
  const suffix = gender ? GENDER_SUFFIX[gender] : undefined
  if (!suffix) return messageKey
  const candidate = `${messageKey}_${suffix}`
  return lookup(i18n, candidate) ? candidate : messageKey
}
