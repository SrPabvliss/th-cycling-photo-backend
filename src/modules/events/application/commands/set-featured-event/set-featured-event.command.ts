export class SetFeaturedEventCommand {
  constructor(
    public readonly eventId: string,
    public readonly isFeatured: boolean,
  ) {}
}
