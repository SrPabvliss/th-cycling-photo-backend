import { Transform } from 'class-transformer'

export const normalizeEmail = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) => normalizeEmail(value))
