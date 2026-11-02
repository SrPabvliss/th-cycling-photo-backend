import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalJson,
  combinationKey,
  recordTransformation,
} from '../src/transformation-record.js'

const ORIGIN = 'https://cycling-photo-dev.s3.us-east-005.backblazeb2.com/events/e-1/photos/u-1.jpg'

test('ignores format and quality when keying a combination', async () => {
  const jpeg = await combinationKey(ORIGIN, {
    width: 400,
    quality: 80,
    fit: 'scale-down',
    format: 'jpeg',
  })
  const auto = await combinationKey(ORIGIN, {
    width: 400,
    quality: 60,
    fit: 'scale-down',
    format: 'auto',
  })

  assert.equal(jpeg, auto)
  assert.match(jpeg, /^[0-9a-f]{64}$/)
})

test('ignores the origin-auth flag when keying a combination', async () => {
  const signed = await combinationKey(ORIGIN, { width: 400, 'origin-auth': 'share-publicly' })
  const plain = await combinationKey(ORIGIN, { width: 400 })

  assert.equal(signed, plain)
})

test('keys a different crop as a different combination', async () => {
  const centre = await combinationKey(ORIGIN, { width: 400, height: 225, fit: 'cover' })
  const framed = await combinationKey(ORIGIN, {
    width: 400,
    height: 225,
    fit: 'cover',
    gravity: { x: 0.2, y: 0.3 },
  })

  assert.notEqual(centre, framed)
})

test('keys the same options in any property order identically', async () => {
  const one = await combinationKey(ORIGIN, { width: 800, draw: [{ url: 'a', repeat: true }] })
  const two = await combinationKey(ORIGIN, { draw: [{ repeat: true, url: 'a' }], width: 800 })

  assert.equal(one, two)
})

test('keys a new watermark version as a new combination', async () => {
  const v1 = await combinationKey(ORIGIN, { width: 800, draw: [{ url: 'https://cdn/wm.png?v=1' }] })
  const v2 = await combinationKey(ORIGIN, { width: 800, draw: [{ url: 'https://cdn/wm.png?v=2' }] })

  assert.notEqual(v1, v2)
})

test('keys a different source image as a different combination', async () => {
  const one = await combinationKey(ORIGIN, { width: 400 })
  const other = await combinationKey(ORIGIN.replace('u-1', 'u-2'), { width: 400 })

  assert.notEqual(one, other)
})

test('serialises nested values with sorted keys', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: null }] }), '{"a":[{"c":null,"d":2}],"b":1}')
})

test('writes one data point indexed by the combination key', () => {
  const written = []
  const env = { TRANSFORMATIONS: { writeDataPoint: (point) => written.push(point) } }

  recordTransformation(env, { key: 'k'.repeat(64), kind: 'internal', slug: 'abc', preset: 'thumb' })

  assert.deepEqual(written, [{ indexes: ['k'.repeat(64)], blobs: ['internal', 'abc', 'thumb'] }])
})

test('never throws when the binding is missing or fails', () => {
  const failing = {
    TRANSFORMATIONS: {
      writeDataPoint: () => {
        throw new Error('analytics engine down')
      },
    },
  }

  assert.doesNotThrow(() =>
    recordTransformation({}, { key: 'k', kind: 'gallery', slug: 's', preset: 'gallery' }),
  )
  assert.doesNotThrow(() =>
    recordTransformation(failing, { key: 'k', kind: 'gallery', slug: 's', preset: 'gallery' }),
  )
})
