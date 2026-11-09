import { AppException } from '@shared/domain'

export const EC_COUNTRY_CODE = '593'

export const SPLIT_TYPE_PHONE = 4

const SUBSCRIBER_PATTERN = /^9\d{8}$/

export function normalizeEcuadorPhone(input: string): string {
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '')

  const withoutCountry = digits.startsWith(EC_COUNTRY_CODE)
    ? digits.slice(EC_COUNTRY_CODE.length)
    : digits
  const subscriber = withoutCountry.startsWith('0') ? withoutCountry.slice(1) : withoutCountry

  if (!SUBSCRIBER_PATTERN.test(subscriber)) {
    throw AppException.businessRule('payment.invalid_phone')
  }

  return subscriber
}

export function toCheckFormat(subscriber: string): string {
  return `0${subscriber}`
}

export function toSplitFormat(subscriber: string): string {
  return `+${EC_COUNTRY_CODE}${subscriber}`
}
