import { normalizeLoginId, normalizeOnSubmit } from '../src/normalize-login-id'

type SubmitListener = (event: { target: unknown }) => void

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-27T12:00:00Z'))
})

afterAll(() => {
  jest.useRealTimers()
})

describe('normalizeLoginId', () => {
  it.each([
    ['19850101-1236', '198501011236'],
    ['198501011236', '198501011236'],
    [' 19850101 1236 ', '198501011236'],
    // A future date typed with its century stays as typed, it is not moved back 100 years
    ['20270101-1237', '202701011237'],
  ])('keeps a 12-digit personnummer as 12 digits: %s', (input, expected) => {
    expect(normalizeLoginId(input)).toBe(expected)
  })

  it.each([
    ['850101-1236', '198501011236'],
    ['0501011233', '200501011233'],
    // Born today: this century
    ['261027-1237', '202610271237'],
    // Born later this year: the previous century, though the year has not come round yet
    ['261028-1236', '192610281236'],
    // Would be next year, so the previous century
    ['270101-1237', '192701011237'],
  ])('adds the century to a 10-digit personnummer: %s', (input, expected) => {
    expect(normalizeLoginId(input)).toBe(expected)
  })

  it.each([
    ['850101\u20131236', 'en dash'],
    ['850101\u20141236', 'em dash'],
    ['850101\u22121236', 'minus sign'],
  ])('accepts %s (%s) as the separator', (input) => {
    expect(normalizeLoginId(input)).toBe('198501011236')
  })

  it("treats '+' as 100 years or older", () => {
    expect(normalizeLoginId('201010+1232')).toBe('192010101232')
  })

  it('handles a samordningsnummer (day + 60)', () => {
    expect(normalizeLoginId('850161-1233')).toBe('198501611233')
  })

  it('drops the separator of a 12-digit number with a wrong check digit', () => {
    expect(normalizeLoginId('19850101-1234')).toBe('198501011234')
  })

  it('leaves a 10-digit number with a wrong check digit as typed', () => {
    expect(normalizeLoginId('850101-1234')).toBe('850101-1234')
  })

  it.each([
    ['556677-8899', '5566778899'],
    ['5566778899', '5566778899'],
    ['16556677-8899', '5566778899'],
  ])('keeps an organisationsnummer as 10 digits: %s', (input, expected) => {
    expect(normalizeLoginId(input)).toBe(expected)
  })

  it.each([
    ['abc', 'abc'],
    ['12345', '12345'],
    ['', ''],
    [undefined, ''],
  ])('leaves anything else as typed: %s', (input, expected) => {
    expect(normalizeLoginId(input)).toBe(expected)
  })
})

describe('normalizeOnSubmit', () => {
  function register() {
    let listener: SubmitListener | undefined
    const target = {
      addEventListener: (_type: string, fn: SubmitListener) => {
        listener = fn
      },
    } as unknown as Pick<Document, 'addEventListener'>
    normalizeOnSubmit(target)
    return (event: { target: unknown }) => listener?.(event)
  }

  it('normalizes the username field before the form is posted', () => {
    const submit = register()
    const field = { value: '19850101-1236' }
    const form = {
      querySelector: (selector: string) =>
        selector === 'input[name="username"]' ? field : null,
    }

    submit({ target: form })

    expect(field.value).toBe('198501011236')
  })

  it('ignores forms without a username field', () => {
    const submit = register()

    expect(() =>
      submit({ target: { querySelector: () => null } })
    ).not.toThrow()
  })
})
