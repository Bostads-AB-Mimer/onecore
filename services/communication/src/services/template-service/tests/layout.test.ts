const organisation = {
  name: 'Bostads AB Mimer',
  visitingAddress: 'Gasverksgatan 7, Västerås',
  phone: '021-39 70 00',
  phoneTel: '+4621397000',
  email: 'post@mimer.nu',
  website: 'https://www.mimer.nu/',
  privacyPolicyUrl: 'https://www.mimer.nu/dataskydd/',
  logoUrl: 'https://cdn.example/logo.png',
  noReplyEmail: 'noreply@mimer.nu',
  orgNumber: '556019-3384',
}

const paymentDetails = {
  bankgiro: '808-6142',
  bic: 'SWEDSESSXXX',
  iban: 'SE9380000842447043538961',
  vatNumber: 'SE556019338401',
}

const mockConfig = {
  organisation: { ...organisation },
  paymentDetails: { ...paymentDetails },
}
jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: mockConfig,
}))

import { EmailLayoutConfigError, wrapInLayout } from '../render/layout'
import { BRAND_COLOR } from '../render/styles'

const fragment = { html: '<p>x</p>', text: 'x' }

describe('wrapInLayout', () => {
  beforeEach(() => {
    mockConfig.organisation = { ...organisation }
    mockConfig.paymentDetails = { ...paymentDetails }
  })

  it('wraps the content with the logo and a contact footer', () => {
    const { html, text } = wrapInLayout(fragment, 'contact')
    expect(html).toMatch(/^<!DOCTYPE html>/i)
    expect(html).toContain('<p>x</p>')
    expect(html).toMatch(/<img [^>]*src="https:\/\/cdn\.example\/logo\.png"/)
    expect(html).toContain('021-39 70 00')
    expect(html).toContain('href="tel:+4621397000"')
    expect(html).toContain('href="https://www.mimer.nu/dataskydd/"')
    expect(text.startsWith('x\n')).toBe(true)
    expect(text.trimEnd().split('\n\n').at(-1)).toContain('021-39 70 00')
  })

  it('shows payment details in the payment footer', () => {
    const { html, text } = wrapInLayout(fragment, 'payment')
    for (const value of ['808-6142', 'SWEDSESSXXX', '556019-3384']) {
      expect(html).toContain(value)
      expect(text).toContain(value)
    }
    expect(html).not.toContain('021-39 70 00')
  })

  it('adds no footer for "none"', () => {
    const { html, text } = wrapInLayout(fragment, 'none')
    expect(html).toContain('<p>x</p>')
    expect(html).not.toContain('021-39 70 00')
    expect(html).not.toContain('808-6142')
    expect(text).toBe('x')
  })

  it('escapes organisation values', () => {
    mockConfig.organisation.name = 'A & B'
    expect(wrapInLayout(fragment, 'payment').html).toContain('A &amp; B')
  })

  it('throws when a value the footer needs is missing from config', () => {
    mockConfig.organisation.phone = ''
    expect(() => wrapInLayout(fragment, 'contact')).toThrow(
      'organisation.phone'
    )
  })

  it('pins the content width for Outlook desktop', () => {
    const { html } = wrapInLayout(fragment, 'none')
    expect(html).toMatch(/<!--\[if mso\]><table[^>]*width="500"/)
  })

  it('puts the logo on white, since the logo has a teal tile', () => {
    const { html } = wrapInLayout(fragment, 'none')
    const headerCell = html.match(/<td[^>]*>(?=<img)/)?.[0] ?? ''
    expect(headerCell).not.toContain(BRAND_COLOR)
  })

  it('escapes organisation values in attributes', () => {
    mockConfig.organisation.privacyPolicyUrl = 'https://a.se/?a=1&b="2"'
    expect(wrapInLayout(fragment, 'contact').html).toContain(
      'href="https://a.se/?a=1&amp;b=&quot;2&quot;"'
    )
  })

  it('leaves out bank lines whose value is not configured', () => {
    mockConfig.paymentDetails = {
      bankgiro: '',
      bic: '',
      iban: '',
      vatNumber: '',
    }
    const { html, text } = wrapInLayout(fragment, 'payment')
    for (const label of ['Bankgiro', 'BIC/SWIFT', 'IBAN', 'Momsreg.nr']) {
      expect(html).not.toContain(label)
      expect(text).not.toContain(label)
    }
    expect(text).toContain('Org.nr: 556019-3384')
  })

  it('only requires the fields the chosen footer shows', () => {
    mockConfig.organisation.phone = ''
    expect(() => wrapInLayout(fragment, 'payment')).not.toThrow()
  })

  it('shows the website without protocol or trailing slash', () => {
    expect(wrapInLayout(fragment, 'payment').html).toContain(
      '>www.mimer.nu</a>'
    )
  })

  it('throws when the logo is missing, whatever the footer', () => {
    mockConfig.organisation.logoUrl = ''
    expect(() => wrapInLayout(fragment, 'none')).toThrow('organisation.logoUrl')
  })

  it('throws a typed config error, so a route can tell nothing was sent', () => {
    mockConfig.organisation.phone = ''
    expect(() => wrapInLayout(fragment, 'contact')).toThrow(
      EmailLayoutConfigError
    )
  })
})
