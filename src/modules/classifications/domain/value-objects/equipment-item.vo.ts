export const EquipmentItem = {
  HELMET: 'helmet',
  JERSEY: 'jersey',
  BIKE: 'bike',
} as const

export type EquipmentItemType = (typeof EquipmentItem)[keyof typeof EquipmentItem]
