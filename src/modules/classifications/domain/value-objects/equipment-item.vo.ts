/**
 * Categories of equipment on a cyclist.
 *
 * - `helmet`   – head protection
 * - `clothing` – jersey, shorts, gloves, shoes, etc.
 * - `bike`     – bicycle frame, wheels, etc.
 */
export const EquipmentItem = {
  HELMET: 'helmet',
  CLOTHING: 'clothing',
  BIKE: 'bike',
} as const

export type EquipmentItemType = (typeof EquipmentItem)[keyof typeof EquipmentItem]
