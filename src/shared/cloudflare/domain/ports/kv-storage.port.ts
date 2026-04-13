export interface IKvStorageAdapter {
  write(key: string, value: string): Promise<void>
  writeBulk(entries: { key: string; value: string }[]): Promise<void>
  delete(key: string): Promise<void>
}

export const KV_STORAGE_ADAPTER = Symbol('KV_STORAGE_ADAPTER')
