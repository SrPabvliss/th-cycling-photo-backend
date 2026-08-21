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
