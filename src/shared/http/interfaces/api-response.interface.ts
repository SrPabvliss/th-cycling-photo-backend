import type { ErrorCode } from '../../domain/exceptions/app.exception'

export interface ApiPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiMeta {
  requestId: string
  timestamp: string
  message?: string | null
  path?: string
  pagination?: ApiPaginationMeta
}

export interface ApiSuccessResponse<T = unknown> {
  data: T
  meta: ApiMeta
}

export interface ApiErrorDetail {
  code: ErrorCode | string
  message: string
  shouldThrow: boolean
  fields?: Record<string, string[]>
  details?: unknown
  stack?: string
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
  meta: ApiMeta
}
