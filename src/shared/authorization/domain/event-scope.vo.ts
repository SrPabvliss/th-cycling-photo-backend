/**
 * Which Event rows a principal may see. Answers a structurally different
 * question than `can()`: `can` decides whether a verb is permitted at all;
 * `EventScope` decides which rows are in reach once it is.
 *
 * `toPrisma()` produces a where clause for the Event model directly, or
 * nested under `{ event: scope.toPrisma() }` for Photo/Order. An empty
 * scope yields `id: { in: [] }`, which matches nothing — deny-by-default
 * falls out of the data rather than needing a special case.
 */
export class EventScope {
  constructor(
    readonly all: boolean,
    readonly tenantIds: string[],
    readonly eventIds: string[],
  ) {}

  /** Sees every event. */
  static unrestricted(): EventScope {
    return new EventScope(true, [], [])
  }

  /** Sees none. */
  static empty(): EventScope {
    return new EventScope(false, [], [])
  }

  get isEmpty(): boolean {
    return !this.all && this.tenantIds.length === 0 && this.eventIds.length === 0
  }

  /** Where clause for the Event model. Nest under `{ event: … }` for Photo/Order. */
  toPrisma(): Record<string, unknown> {
    if (this.all) return {}
    return { OR: [{ tenant_id: { in: this.tenantIds } }, { id: { in: this.eventIds } }] }
  }
}
