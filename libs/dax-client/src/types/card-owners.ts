/**
 * Card Owner types
 */

import type { Card } from './cards'

export interface CardOwner {
  cardOwnerId: string
  cardOwnerType?: string | null
  familyName?: string | null
  specificName?: string | null
  primaryOrganization?: any // TODO: Define OrganizationItem type when needed
  cards?: Card[] | null
  comment?: string | null
  folderId?: number | null
  disabled?: boolean
  startTime?: string | null
  stopTime?: string | null
  pinCode?: string | null
  attributes?: Record<string, string> | null
  state?: string | null
  archivedAt?: string | null
  createTime?: string
}

export interface QueryCardOwnersParams {
  // Path parameters (required, but passed separately in the function call)
  owningPartnerId: string
  owningInstanceId: string

  // Query parameters (optional)
  expand?: string // e.g., "cards,postbox"
  idfilter?: string // Comma separated list of IDs
  nameFilter?: string // Comma separated list of names
  attributeFilter?: string // Comma separated key=value pairs
  selectedAttributes?: string // Comma separated list of attribute keys
  folderFilter?: string // Comma separated list of folder IDs
  organisationFilter?: string // Comma separated list of organisation IDs
  offset?: number
  limit?: number
}
