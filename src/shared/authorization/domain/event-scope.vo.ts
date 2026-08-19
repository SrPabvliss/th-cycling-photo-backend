/**
 * Which Event rows a principal may see. `can()` decides whether a verb is permitted at all;
 * `EventScope` decides which rows are in reach once it is.
 *
 * An empty scope yields `id: { in: [] }`, so deny-by-default falls out of the data.
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

  /**
   * In-memory equivalent of nesting `event: scope.toPrisma()` into a query, for a handler that has
   * already loaded the Event by its own id and cannot cheaply re-query.
   */
  includesEvent(event: { id: string; tenantId: string }): boolean {
    if (this.all) return true
    return this.tenantIds.includes(event.tenantId) || this.eventIds.includes(event.id)
  }
}
