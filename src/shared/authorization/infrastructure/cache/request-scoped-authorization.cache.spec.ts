import { EMPTY_PRINCIPAL_PERMISSIONS } from '../../domain/principal'
import {
  authorizationStore,
  RequestScopedAuthorizationCache,
} from './request-scoped-authorization.cache'

describe('RequestScopedAuthorizationCache', () => {
  const cache = new RequestScopedAuthorizationCache()

  it('returns null outside a request scope instead of throwing', async () => {
    await expect(cache.get('u1')).resolves.toBeNull()
    await expect(cache.set('u1', EMPTY_PRINCIPAL_PERMISSIONS())).resolves.toBeUndefined()
    await expect(cache.invalidate('u1')).resolves.toBeUndefined()
  })

  it('memoises within one request scope', async () => {
    await authorizationStore.run(new Map(), async () => {
      const p = EMPTY_PRINCIPAL_PERMISSIONS()
      p.isPlatform = true
      await cache.set('u1', p)
      await expect(cache.get('u1')).resolves.toBe(p)
    })
  })

  it('does not leak between request scopes', async () => {
    await authorizationStore.run(new Map(), async () => {
      await cache.set('u1', EMPTY_PRINCIPAL_PERMISSIONS())
    })
    await authorizationStore.run(new Map(), async () => {
      await expect(cache.get('u1')).resolves.toBeNull()
    })
  })

  it('invalidate removes the memo', async () => {
    await authorizationStore.run(new Map(), async () => {
      await cache.set('u1', EMPTY_PRINCIPAL_PERMISSIONS())
      await cache.invalidate('u1')
      await expect(cache.get('u1')).resolves.toBeNull()
    })
  })
})
