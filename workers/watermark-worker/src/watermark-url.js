const EVENT_PATH = /^events\/([^/]+)\//

function hashPath(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function eventIdFromObjectPath(objectPath) {
  const match = EVENT_PATH.exec(objectPath)
  return match ? match[1] : null
}

export function resolveWatermarkUrl(eventId, wmPath, publicDomain) {
  if (!eventId || !wmPath) {
    return `https://${publicDomain}/gallery/_assets/watermark.png?v=3`
  }
  return `https://${publicDomain}/assets/wm-${eventId}.png?v=${hashPath(wmPath)}`
}

/**
 * The crop origin travels in the request rather than in KV. Workers KV caches every read at the
 * edge for at least a minute, so a re-framed cover kept serving the previous crop until that
 * expired; the query string is read on the spot and doubles as the cache key.
 */
export function gravityFromQuery(params) {
  const raw = params.get('g')
  if (!raw) return null

  const [x, y] = raw.split('x').map(Number)
  const isFraction = (value) => Number.isFinite(value) && value >= 0 && value <= 1
  return isFraction(x) && isFraction(y) ? { x, y } : null
}
