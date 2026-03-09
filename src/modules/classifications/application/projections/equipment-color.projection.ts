export class EquipmentColorProjection {
  /** EquipmentColor UUID */
  id: string
  /** Equipment category: 'helmet', 'clothing', or 'bike' */
  itemType: string
  /** W3C color name */
  colorName: string
  /** W3C hex code */
  colorHex: string
  /** AI raw centroid hex (null for manual) */
  rawHex: string | null
  /** AI color density percentage (null for manual) */
  densityPercentage: number | null
}
