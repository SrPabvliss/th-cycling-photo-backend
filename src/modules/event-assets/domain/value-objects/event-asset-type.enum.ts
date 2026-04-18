/**
 * Domain representation of the event asset types.
 * Decoupled from Prisma to prevent layer violations.
 */
export type EventAssetType = 'cover_image' | 'event_logo' | 'hero_image' | 'poster'
