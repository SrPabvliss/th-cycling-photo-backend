export class ClearEventPricingConfigCommand {
  constructor(
    public readonly eventId: string,
    public readonly clearedById: string,
  ) {}
}
