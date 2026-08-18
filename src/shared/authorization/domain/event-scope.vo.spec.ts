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
})
