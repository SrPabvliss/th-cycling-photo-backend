export type YupanaOutcome = 'accepted' | 'duplicate' | 'rejected'

export interface YupanaItemResult {
  key: string
  outcome: YupanaOutcome
  reason: string | null
}

export interface IYupanaClient {
  isConfigured(): boolean
  sendReports(reports: Record<string, unknown>[]): Promise<YupanaItemResult[]>
  sendDeclarations(declarations: Record<string, unknown>[]): Promise<YupanaItemResult[]>
  read(path: string, query: Record<string, string | undefined>): Promise<unknown>
}

export const YUPANA_CLIENT = Symbol('YUPANA_CLIENT')
