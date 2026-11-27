import { placeholderText } from './placeholderMark'

export type AddressKind = 'link' | 'button' | 'image'

// Mirrors the backend save check: links https/mailto/tel, images https only.
const LINK = /^(https:\/\/|mailto:|tel:)\S+$/i
const IMAGE = /^https:\/\/\S+$/i

/** Whether an address may be saved, given the url placeholders on offer. */
export const isAllowedAddress = (
  href: string,
  kind: AddressKind,
  urlTokens: string[]
): boolean => {
  const value = href.trim()
  if (urlTokens.some((token) => placeholderText(token) === value)) return true
  return (kind === 'image' ? IMAGE : LINK).test(value)
}

export const addressHint = (kind: AddressKind) =>
  kind === 'image'
    ? 'Bildadressen ska börja med https://'
    : 'Adressen ska börja med https://, mailto: eller tel:'
