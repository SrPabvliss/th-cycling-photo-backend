/**
 * Which Event rows a principal may see. `can()` decides whether a verb is permitted at all;
 * `EventScope` decides which rows are in reach once it is.
 *
 * Reach is `(tenant in tenantIds AND id not in deniedEventIds) OR id in eventIds`: the tenant
 * branch comes from a template or global grant, `deniedEventIds` are the explicit per-event denies
 * that carve holes into it, and `eventIds` are the per-event allows.
 *
 * An empty scope yields `id: { in: [] }`, so deny-by-default falls out of the data.
 */
export class EventScope {
  constructor(
    readonly all: boolean,
    readonly tenantIds: string[],
    readonly eventIds: string[],
    readonly deniedEventIds: string[] = [],
  ) {}

  /** Sees every event. */
  static unrestricted(): EventScope {
    return new EventScope(true, [], [])
  }

  /** Sees none. */
  static empty(): EventScope {
    return new EventScope(false, [], [])
  }

  /**
   * Rows reachable through any of the scopes. Only exact when the tenant branches agree, which is
   * always the case for scopes of one principal (a user has at most one tenant).
   */
  static union(...scopes: EventScope[]): EventScope {
    if (scopes.some((s) => s.all)) return EventScope.unrestricted()

    const withTenant = scopes.filter((s) => s.tenantIds.length > 0)
    const tenantIds = [...new Set(withTenant.flatMap((s) => s.tenantIds))]
    if (withTenant.some((s) => s.tenantIds.length !== tenantIds.length)) {
      throw new Error('EventScope.union requires every tenant branch to cover the same tenants')
    }

    const deniedEventIds = withTenant.reduce<string[] | null>(
      (acc, s) =>
        acc === null ? [...s.deniedEventIds] : acc.filter((id) => s.deniedEventIds.includes(id)),
      null,
    )
    const eventIds = [...new Set(scopes.flatMap((s) => s.eventIds))]

    return new EventScope(false, tenantIds, eventIds, deniedEventIds ?? [])
  }

  get isEmpty(): boolean {
    return !this.all && this.tenantIds.length === 0 && this.eventIds.length === 0
  }

  /** Where clause for the Event model. Nest under `{ event: … }` for Photo/Order. */
  toPrisma(): Record<string, unknown> {
    if (this.all) return {}
    const tenantBranch: Record<string, unknown> = { tenant_id: { in: this.tenantIds } }
    if (this.deniedEventIds.length > 0) tenantBranch.id = { notIn: this.deniedEventIds }
    return { OR: [tenantBranch, { id: { in: this.eventIds } }] }
  }

  /**
   * In-memory equivalent of nesting `event: scope.toPrisma()` into a query, for a handler that has
   * already loaded the Event by its own id and cannot cheaply re-query.
   */
  includesEvent(event: { id: string; tenantId: string }): boolean {
    if (this.all) return true
    if (this.eventIds.includes(event.id)) return true
    return this.tenantIds.includes(event.tenantId) && !this.deniedEventIds.includes(event.id)
  }
}
