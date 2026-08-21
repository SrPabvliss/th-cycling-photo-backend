export function isSafeStorageKey(key: string): boolean {
  return key.split('/').every((segment) => segment !== '..')
}
