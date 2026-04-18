export class GearColorProjection {
  /** GearColor UUID */
  id: string
  /** Gear type ID (FK to gear_types table) */
  gearTypeId: number
  /** W3C color name */
  colorName: string
  /** W3C hex code */
  colorHex: string
  /** AI raw centroid hex (null for manual) */
  rawHex: string | null
  /** AI color density percentage (null for manual) */
  densityPercentage: number | null
}
