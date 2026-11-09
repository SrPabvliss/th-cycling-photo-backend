export type CostsResource = 'summary' | 'health' | 'events' | 'event' | 'photo'

export interface ReadCostsParams {
  month?: string
  environment?: string
  pricing?: string
  id?: string
}

export class ReadCostsQuery {
  constructor(
    public readonly resource: CostsResource,
    public readonly params: ReadCostsParams,
  ) {}
}
