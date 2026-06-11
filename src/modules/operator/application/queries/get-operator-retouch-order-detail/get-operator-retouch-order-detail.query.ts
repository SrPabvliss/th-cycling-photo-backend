export type RetouchOrderDetailScope = 'pending' | 'all'

export class GetOperatorRetouchOrderDetailQuery {
  constructor(
    public readonly orderId: string,
    public readonly operatorId: string,
    public readonly scope: RetouchOrderDetailScope = 'pending',
    public readonly userRole: string = 'operator',
  ) {}
}
