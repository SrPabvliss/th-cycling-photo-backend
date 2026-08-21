import assert from 'node:assert/strict'
import test from 'node:test'

import { eventIdFromObjectPath, resolveWatermarkUrl } from '../src/watermark-url.js'

const DOMAIN = 'cdn-dev.titantv.com.ec'
const FALLBACK = `https://${DOMAIN}/gallery/_assets/watermark.png?v=3`

test('extracts the event id from every gallery-served path layout', () => {
  assert.equal(eventIdFromObjectPath('events/abc-123/photos/uuid-IMG_001.jpg'), 'abc-123')
  assert.equal(eventIdFromObjectPath('events/abc-123/retouched/uuid-IMG_001.jpg'), 'abc-123')
  assert.equal(eventIdFromObjectPath('events/abc-123/assets/cover_image/uuid-b.jpg'), 'abc-123')
})

test('returns null for a path that is not event-scoped', () => {
  assert.equal(eventIdFromObjectPath('tenants/t-1/watermark/uuid-logo.png'), null)
  assert.equal(eventIdFromObjectPath('events/abc-123'), null)
})

test('falls back to the global mark when the event has no watermark entry', () => {
  assert.equal(resolveWatermarkUrl('abc-123', null, DOMAIN), FALLBACK)
})

test('falls back to the global mark when the path is not event-scoped', () => {
  assert.equal(resolveWatermarkUrl(null, 'tenants/t-1/watermark/uuid-logo.png', DOMAIN), FALLBACK)
})

test('builds a per-event watermark url', () => {
  const url = resolveWatermarkUrl('abc-123', 'tenants/t-1/watermark/uuid-logo.png', DOMAIN)
  assert.match(url, /^https:\/\/cdn-dev\.titantv\.com\.ec\/assets\/wm-abc-123\.png\?v=[a-z0-9]+$/)
})

test('the cache buster changes when the storage key changes', () => {
  const first = resolveWatermarkUrl('abc-123', 'tenants/t-1/watermark/aaa-logo.png', DOMAIN)
  const second = resolveWatermarkUrl('abc-123', 'tenants/t-1/watermark/bbb-logo.png', DOMAIN)
  assert.notEqual(first, second)
})
