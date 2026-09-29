import { guides } from '@onecore/types'

// Swedish letters map to their base letter rather than being dropped, so
// "Uppsägning" becomes "uppsagning" instead of "uppsgning".
const SWEDISH_REPLACEMENTS: Record<string, string> = {
  å: 'a',
  ä: 'a',
  ö: 'o',
  é: 'e',
  ü: 'u',
}

/**
 * Turn free text into a URL slug: lowercase ascii letters, digits and single
 * hyphens, matching SlugSchema in @onecore/types.
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[åäöéü]/g, (char) => SWEDISH_REPLACEMENTS[char] ?? char)
      .normalize('NFD')
      // Combining diacritical marks left over by the NFD normalisation above.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200)
      .replace(/-+$/g, '')
  )
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isReservedSlug = (slug: string) =>
  (guides.RESERVED_SLUGS as readonly string[]).includes(slug)

export const isValidSlug = (slug: string) =>
  slug.length > 0 &&
  slug.length <= 200 &&
  SLUG_PATTERN.test(slug) &&
  !isReservedSlug(slug)
