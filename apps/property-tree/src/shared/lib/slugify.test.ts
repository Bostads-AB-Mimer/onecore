import { isValidSlug, slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Registrera uppsägning i Tenfast')).toBe(
      'registrera-uppsagning-i-tenfast'
    )
  })

  it('maps Swedish letters to their base letters', () => {
    expect(slugify('Åtgärd för Öresund')).toBe('atgard-for-oresund')
  })

  it('collapses punctuation and whitespace into single hyphens', () => {
    expect(slugify('  Skapa   ströfaktura: steg 1 / 2! ')).toBe(
      'skapa-strofaktura-steg-1-2'
    )
  })

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('')
  })

  it('caps the length at 200 characters without a trailing hyphen', () => {
    const slug = slugify('a '.repeat(150))
    expect(slug.length).toBeLessThanOrEqual(200)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('isValidSlug', () => {
  it('accepts what slugify produces', () => {
    expect(isValidSlug(slugify('Registrera uppsägning'))).toBe(true)
  })

  it('rejects uppercase, spaces and double hyphens', () => {
    expect(isValidSlug('Bad Slug')).toBe(false)
    expect(isValidSlug('double--hyphen')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })
})
