const organisation = {
  name: 'Bostads AB Mimer',
  visitingAddress: 'Gasverksgatan 7, Västerås',
  phone: '021-39 70 00',
  phoneTel: '+4621397000',
  email: 'post@mimer.nu',
  privacyPolicyUrl: 'https://www.mimer.nu/dataskydd/',
  logoUrl: 'https://cdn.example/logo.png',
  noReplyEmail: 'noreply@mimer.nu',
}

const mockConfig = { organisation: { ...organisation } }
jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: mockConfig,
}))

import {
  EmailLayoutConfigError,
  layoutChrome,
  wrapInLayout,
} from '../render/layout'
import { BRAND_COLOR } from '../render/styles'

const fragment = { html: '<p>x</p>', text: 'x' }

describe('wrapInLayout', () => {
  beforeEach(() => {
    mockConfig.organisation = { ...organisation }
  })

  it('wraps the content with the logo and the contact footer', () => {
    const { html, text } = wrapInLayout(fragment)
    expect(html).toMatch(/^<!DOCTYPE html>/i)
    expect(html).toContain('<p>x</p>')
    expect(html).toMatch(/<img [^>]*src="https:\/\/cdn\.example\/logo\.png"/)
    expect(html).toContain('021-39 70 00')
    expect(html).toContain('href="tel:+4621397000"')
    expect(html).toContain('href="https://www.mimer.nu/dataskydd/"')
    expect(text.startsWith('x\n')).toBe(true)
    expect(text.trimEnd().split('\n\n').at(-1)).toContain('021-39 70 00')
  })

  it('escapes organisation values', () => {
    mockConfig.organisation.name = 'A & B'
    expect(wrapInLayout(fragment).html).toContain('A &amp; B')
  })

  it('throws when a value the footer needs is missing from config', () => {
    mockConfig.organisation.phone = ''
    expect(() => wrapInLayout(fragment)).toThrow('organisation.phone')
  })

  it('pins the content width for Outlook desktop', () => {
    const { html } = wrapInLayout(fragment)
    expect(html).toMatch(/<!--\[if mso\]><table[^>]*width="500"/)
  })

  it('puts the logo on white, since the logo has a teal tile', () => {
    const { html } = wrapInLayout(fragment)
    const headerCell = html.match(/<td[^>]*>(?=<img)/)?.[0] ?? ''
    expect(headerCell).not.toContain(BRAND_COLOR)
  })

  it('escapes organisation values in attributes', () => {
    mockConfig.organisation.privacyPolicyUrl = 'https://a.se/?a=1&b="2"'
    expect(wrapInLayout(fragment).html).toContain(
      'href="https://a.se/?a=1&amp;b=&quot;2&quot;"'
    )
  })

  it('throws when the logo is missing', () => {
    mockConfig.organisation.logoUrl = ''
    expect(() => wrapInLayout(fragment)).toThrow('organisation.logoUrl')
  })

  it('throws a typed config error, so a route can tell nothing was sent', () => {
    mockConfig.organisation.phone = ''
    expect(() => wrapInLayout(fragment)).toThrow(EmailLayoutConfigError)
  })
})

describe('layoutChrome', () => {
  beforeEach(() => {
    mockConfig.organisation = { ...organisation }
  })

  it('gives the editor the logo and the footer lines of the email', () => {
    const chrome = layoutChrome()
    expect(chrome.logoUrl).toBe('https://cdn.example/logo.png')
    expect(chrome.footerLines.join('\n')).toBe(
      wrapInLayout(fragment).text.split('\n\n').at(-1)
    )
  })

  it('is empty rather than failing when the config is missing', () => {
    mockConfig.organisation.logoUrl = ''
    expect(layoutChrome()).toEqual({ logoUrl: null, footerLines: [] })
  })
})
