import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator'

const MIN_LENGTH = 8
const MAX_LENGTH = 128
const HAS_LETTER = /\p{L}/u
const HAS_DIGIT = /\d/

/**
 * The password an account may be given: 8 to 128 characters with at least one letter (of any
 * alphabet, so `ñ` and accented letters count) and at least one digit. Any other character is
 * allowed, spaces included, and nothing is trimmed.
 *
 * Only for a password being set. Login and "current password" fields must keep accepting whatever
 * was stored before the rule existed.
 */
export function isAccountPassword(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length >= MIN_LENGTH &&
    value.length <= MAX_LENGTH &&
    HAS_LETTER.test(value) &&
    HAS_DIGIT.test(value)
  )
}

export function IsAccountPassword(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isAccountPassword',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate: (value: unknown) => isAccountPassword(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be ${MIN_LENGTH} to ${MAX_LENGTH} characters long and contain at least one letter and one number`,
      },
    })
  }
}
