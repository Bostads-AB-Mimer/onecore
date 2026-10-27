import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'

const SCRIPT = readFileSync(
  join(__dirname, '../theme/mimer/login/resources/js/normalize-login-id.js'),
  'utf8'
)

type Normalize = (input: unknown, now?: Date) => string
type SubmitListener = (event: { target: unknown }) => void

// Runs the script the way the browser does: as a classic script that defines a global.
function load(globals: Record<string, unknown> = {}) {
  const context: Record<string, unknown> = { ...globals }
  runInNewContext(SCRIPT, context)
  return context.normalizeLoginId as Normalize
}

const NOW = new Date('2026-10-27T12:00:00Z')

describe('normalizeLoginId', () => {
  const normalize = load()

  it.each([
    ['19850101-1234', '198501011234'],
    ['198501011234', '198501011234'],
    [' 19850101 1234 ', '198501011234'],
  ])('keeps a 12-digit personnummer as 12 digits: %s', (input, expected) => {
    expect(normalize(input, NOW)).toBe(expected)
  })

  it.each([
    ['850101-1234', '198501011234'],
    ['0501011234', '200501011234'],
    // Born this year: still this century
    ['260101-1234', '202601011234'],
    // Would be in the future, so the previous century
    ['270101-1234', '192701011234'],
  ])('adds the century to a 10-digit personnummer: %s', (input, expected) => {
    expect(normalize(input, NOW)).toBe(expected)
  })

  it("treats '+' as 100 years or older", () => {
    expect(normalize('201010+1234', NOW)).toBe('192010101234')
  })

  it.each([
    ['556677-8899', '5566778899'],
    ['5566778899', '5566778899'],
    ['16556677-8899', '5566778899'],
  ])('keeps an organisationsnummer as 10 digits: %s', (input, expected) => {
    expect(normalize(input, NOW)).toBe(expected)
  })

  it.each([
    ['abc', 'abc'],
    ['12345', '12345'],
    ['', ''],
    [undefined, ''],
  ])('leaves anything else as typed: %s', (input, expected) => {
    expect(normalize(input, NOW)).toBe(expected)
  })
})

describe('submit handler', () => {
  it('normalizes the username field before the form is posted', () => {
    let listener: SubmitListener | undefined
    load({
      document: {
        addEventListener: (_type: string, fn: SubmitListener) => {
          listener = fn
        },
      },
    })
    const field = { value: '19850101-1234' }
    const form = {
      querySelector: (selector: string) =>
        selector === 'input[name="username"]' ? field : null,
    }

    listener?.({ target: form })

    expect(field.value).toBe('198501011234')
  })

  it('ignores forms without a username field', () => {
    let listener: SubmitListener | undefined
    load({
      document: {
        addEventListener: (_type: string, fn: SubmitListener) => {
          listener = fn
        },
      },
    })

    expect(() =>
      listener?.({ target: { querySelector: () => null } })
    ).not.toThrow()
  })
})
