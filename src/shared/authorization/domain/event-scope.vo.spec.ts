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
})
