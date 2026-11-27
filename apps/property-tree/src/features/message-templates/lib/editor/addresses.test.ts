import { describe, expect, it } from 'vitest'

import { isAllowedAddress } from './addresses'

describe('isAllowedAddress', () => {
  it('allows https, mailto and tel links', () => {
    expect(isAllowedAddress('https://www.mimer.nu', 'link', [])).toBe(true)
    expect(isAllowedAddress('mailto:kundcenter@mimer.nu', 'button', [])).toBe(
      true
    )
    expect(isAllowedAddress(' tel:+4621397000 ', 'link', [])).toBe(true)
  })

  it('allows only https images', () => {
    expect(isAllowedAddress('https://www.mimer.nu/a.png', 'image', [])).toBe(
      true
    )
    expect(isAllowedAddress('mailto:a@mimer.nu', 'image', [])).toBe(false)
  })

  it.each(['http://www.mimer.nu', '/mina-sidor', 'www.mimer.nu', 'https://'])(
    'rejects %j',
    (href) => {
      expect(isAllowedAddress(href, 'link', [])).toBe(false)
    }
  )

  it('allows a url placeholder the template offers, and no other', () => {
    expect(isAllowedAddress('{{offerURL}}', 'button', ['offerURL'])).toBe(true)
    expect(isAllowedAddress('{{firstName}}', 'link', ['offerURL'])).toBe(false)
  })
})
