/**
 * Card types
 */

export interface Card {
  cardId: string
  name?: string | null
  owner?: any // TODO: Reference CardOwner (circular ref issue)
  appearanceCode?: string | null
  classification?: string | null
  disabled?: boolean
  startTime?: string | null
  stopTime?: string | null
  createTime: string
  pinCode?: string | null
  state?: string | null
  archivedAt?: string | null
  codes?: any[] | null // TODO: CardNumberItem type
}
