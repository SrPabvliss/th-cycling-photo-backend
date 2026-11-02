export interface CdnTransformationPoint {
  combinationKey: string
  kind: string
  slug: string
}

export interface ICdnTransformationSource {
  isConfigured(): boolean
  readDay(day: string): Promise<CdnTransformationPoint[]>
  findFirstDay(): Promise<string | null>
}

export const CDN_TRANSFORMATION_SOURCE = Symbol('CDN_TRANSFORMATION_SOURCE')
