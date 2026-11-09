export class GetAllCategoriesQuery {
  constructor(
    public readonly userId: string,
    /** When given, the categories available to that event's organizer instead of the caller's. */
    public readonly eventId: string | null,
  ) {}
}
