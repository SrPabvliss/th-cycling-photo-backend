export class IssueContractCommand {
  constructor(
    public readonly ownerEmail: string,
    public readonly commercialName: string,
    public readonly eventsTotal: number,
    public readonly photosPerEvent: number,
    public readonly validUntil: Date,
    public readonly issuedById: string,
  ) {}
}
