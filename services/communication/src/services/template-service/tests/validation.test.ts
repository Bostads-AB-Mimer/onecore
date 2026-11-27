import { TrustedHtml } from '../render/trusted-html'
import { SYSTEM_EMAIL_FIXTURES } from '../system-email-fixtures'
import {
  PlaceholderDef,
  SYSTEM_TEMPLATE_KEYS,
  SYSTEM_TEMPLATE_PLACEHOLDERS,
} from '../system-templates'
import {
  TemplateRules,
  TemplateValidationError,
  validateTemplate,
} from '../validation'

jest.mock('@onecore/utilities', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}))

const placeholders: PlaceholderDef[] = [
  { token: 'firstName', label: 'Förnamn', kind: 'text' },
  { token: 'offerURL', label: 'Länk', kind: 'url' },
  { token: 'message', label: 'Meddelande', kind: 'block', required: true },
]
const rules: TemplateRules = {
  placeholders,
  examples: {
    firstName: 'Åsa',
    offerURL: 'https://www.mimer.nu/erbjudande/1',
    message: TrustedHtml.fromUntrusted('<p>Vi kommer på torsdag.</p>'),
  },
}

const codeOf = (template: { subject: string | null; body: string }) => {
  try {
    validateTemplate(template, rules)
  } catch (err: unknown) {
    if (err instanceof TemplateValidationError) return [err.code, err.details]
    throw err
  }
  return null
}

describe('validateTemplate', () => {
  it('accepts a template that uses its placeholders correctly', () => {
    expect(
      codeOf({
        subject: 'Hej {{firstName}}',
        body: 'Hej **{{firstName}}**!\n\n{{message}}\n\n[Svara]({{offerURL}} "button")\n\n![Bild](https://www.mimer.nu/a.png)',
      })
    ).toBeNull()
  })

  it('rejects a token the send does not supply, in body or subject', () => {
    expect(codeOf({ subject: '{{rent}}', body: '{{message}} {{x}}' })).toEqual([
      'UNKNOWN_PLACEHOLDER',
      ['rent', 'x'],
    ])
  })

  it('rejects a body without a required token', () => {
    expect(codeOf({ subject: 'Hej', body: 'Hej {{firstName}}' })).toEqual([
      'MISSING_REQUIRED_PLACEHOLDER',
      ['message'],
    ])
  })

  it.each([
    ['inside running text', 'Hej {{message}}'],
    ['twice, once inline', '{{message}}\n\nOch {{message}}'],
    ['in a fact table', '| | |\n|-|-|\n| A | {{message}} |'],
  ])('rejects a block token %s', (_case, body) => {
    expect(codeOf({ subject: 'Hej', body })).toEqual([
      'PLACEHOLDER_NOT_ALONE',
      ['message'],
    ])
  })

  it('rejects a block token in the subject', () => {
    expect(codeOf({ subject: '{{message}}', body: '{{message}}' })).toEqual([
      'PLACEHOLDER_NOT_ALONE',
      ['message'],
    ])
  })

  it.each([
    ['an http image', '![a](http://www.mimer.nu/a.png)'],
    ['a mailto image', '![a](mailto:a@mimer.nu)'],
    ['an http link', '[a](http://www.mimer.nu)'],
    ['a relative link', '[a](/mina-sidor)'],
  ])('rejects %s typed in directly', (_case, line) => {
    expect(codeOf({ subject: 'Hej', body: `{{message}}\n\n${line}` })).toEqual([
      'INVALID_URL',
      [expect.any(String)],
    ])
  })

  it('accepts https images and mailto/tel links typed in directly', () => {
    expect(
      codeOf({
        subject: 'Hej',
        body: '{{message}}\n\n![a](https://www.mimer.nu/a.png) [b](mailto:a@mimer.nu) [c](tel:+4621397000)',
      })
    ).toBeNull()
  })

  it('rejects a text placeholder used as a link address', () => {
    expect(
      codeOf({ subject: 'Hej', body: '{{message}}\n\n[a]({{firstName}})' })
    ).toEqual(['INVALID_PLACEHOLDER_URL', ['firstName']])
  })

  it('returns the plain text and enforces the SMS limit', () => {
    const sms: TemplateRules = {
      placeholders: [],
      examples: {},
      smsTextLimit: 10,
    }
    expect(validateTemplate({ subject: null, body: '**Hej**' }, sms)).toEqual({
      text: 'Hej',
    })
    // The limit counts the SMS text, not the markdown.
    expect(() =>
      validateTemplate({ subject: null, body: `**${'a'.repeat(10)}**` }, sms)
    ).not.toThrow()
    expect(() =>
      validateTemplate({ subject: null, body: 'a'.repeat(11) }, sms)
    ).toThrow(expect.objectContaining({ code: 'SMS_TEXT_TOO_LONG' }))
  })
})

describe('SYSTEM_TEMPLATE_PLACEHOLDERS', () => {
  it.each(SYSTEM_TEMPLATE_KEYS)(
    '%s lists exactly what its send supplies',
    (key) => {
      const tokens = SYSTEM_TEMPLATE_PLACEHOLDERS[key].map((p) => p.token)
      expect(new Set(tokens).size).toBe(tokens.length)
      expect([...tokens].sort()).toEqual(
        Object.keys(SYSTEM_EMAIL_FIXTURES[key]).sort()
      )
    }
  )

  it.each(SYSTEM_TEMPLATE_KEYS)('%s kinds match the values', (key) => {
    const fixture = SYSTEM_EMAIL_FIXTURES[key]
    for (const p of SYSTEM_TEMPLATE_PLACEHOLDERS[key]) {
      const value = fixture[p.token]
      if (p.kind === 'block') expect(value).toBeInstanceOf(TrustedHtml)
      else expect(typeof value).toBe('string')
      if (p.kind === 'url') expect(value).toMatch(/^https:/)
    }
  })
})
