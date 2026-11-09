import { EventScope } from './event-scope.vo'

describe('EventScope', () => {
  it('unrestricted() produces an empty where clause', () => {
    expect(EventScope.unrestricted().toPrisma()).toEqual({})
  })

  it('empty() matches nothing', () => {
    const w = EventScope.empty().toPrisma()
    expect(w).toEqual({ OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }] })
  })

  it('combines tenant ownership and per-event grants with OR', () => {
    const w = new EventScope(false, ['t1'], ['e9']).toPrisma()
    expect(w).toEqual({ OR: [{ tenant_id: { in: ['t1'] } }, { id: { in: ['e9'] } }] })
  })

  it('reports emptiness correctly', () => {
    expect(EventScope.empty().isEmpty).toBe(true)
    expect(EventScope.unrestricted().isEmpty).toBe(false)
    expect(new EventScope(false, [], ['e1']).isEmpty).toBe(false)
  })

  describe('includesEvent', () => {
    it('unrestricted() includes any event', () => {
      expect(EventScope.unrestricted().includesEvent({ id: 'e-x', tenantId: 't-x' })).toBe(true)
    })

    it('empty() excludes every event', () => {
      expect(EventScope.empty().includesEvent({ id: 'e-1', tenantId: 't-1' })).toBe(false)
    })

    it('includes an event whose tenant matches the scope', () => {
      const scope = new EventScope(false, ['t1'], [])
      expect(scope.includesEvent({ id: 'e-other', tenantId: 't1' })).toBe(true)
    })

    it('includes an event granted directly by id, regardless of tenant', () => {
      const scope = new EventScope(false, [], ['e9'])
      expect(scope.includesEvent({ id: 'e9', tenantId: 't-other' })).toBe(true)
    })

    it('excludes an event matching neither the tenant nor the id list', () => {
      const scope = new EventScope(false, ['t1'], ['e9'])
      expect(scope.includesEvent({ id: 'e-other', tenantId: 't-other' })).toBe(false)
    })
  })

  describe('deniedEventIds', () => {
    const scope = new EventScope(false, ['t1'], ['e9'], ['e1'])

    it('carves the denied events out of the tenant branch only', () => {
      expect(scope.toPrisma()).toEqual({
        OR: [{ tenant_id: { in: ['t1'] }, id: { notIn: ['e1'] } }, { id: { in: ['e9'] } }],
      })
    })

    it('excludes a denied event of the tenant in memory', () => {
      expect(scope.includesEvent({ id: 'e1', tenantId: 't1' })).toBe(false)
      expect(scope.includesEvent({ id: 'e2', tenantId: 't1' })).toBe(true)
    })
  })

  describe('union', () => {
    it('is unrestricted when any part is', () => {
      expect(EventScope.union(EventScope.empty(), EventScope.unrestricted()).all).toBe(true)
    })

    it('merges event grants and keeps the shared tenant', () => {
      const u = EventScope.union(
        new EventScope(false, ['t1'], ['e1']),
        new EventScope(false, [], ['e2']),
      )
      expect(u.tenantIds).toEqual(['t1'])
      expect(u.eventIds.sort()).toEqual(['e1', 'e2'])
    })

    it('keeps a deny only when every tenant branch denies the event', () => {
      const u = EventScope.union(
        new EventScope(false, ['t1'], [], ['e1', 'e2']),
        new EventScope(false, ['t1'], [], ['e1']),
      )
      expect(u.deniedEventIds).toEqual(['e1'])
    })

    it('keeps the deny of the only tenant branch', () => {
      const u = EventScope.union(
        new EventScope(false, ['t1'], [], ['e1']),
        new EventScope(false, [], ['e5']),
      )
      expect(u.deniedEventIds).toEqual(['e1'])
    })

    it('rejects tenant branches over different tenants', () => {
      expect(() =>
        EventScope.union(new EventScope(false, ['t1'], []), new EventScope(false, ['t2'], [])),
      ).toThrow()
    })
  })
})
