import { Prisma } from '@prisma/client'
import { trimStrings } from '@src/utils/data-conversion'

describe(trimStrings, () => {
  it('trims single string', () => {
    const input = '  foo  '
    const expected = 'foo'
    expect(trimStrings(input)).toEqual(expected)
  })

  it('trims array of strings', () => {
    const input = ['  foo  ', '  bar  ']
    const expected = ['foo', 'bar']
    expect(trimStrings(input)).toEqual(expected)
  })

  it('trims array of object of strings', () => {
    const input = [{ foo: ' foo ' }, '  bar  ']
    const expected = [{ foo: 'foo' }, 'bar']
    expect(trimStrings(input)).toEqual(expected)
  })

  it('trims nested array of object of strings', () => {
    const input = [{ foo: [{ baz: [{ qux: '  qux  ' }, 'ok '] }] }, '  bar  ']
    const expected = [{ foo: [{ baz: [{ qux: 'qux' }, 'ok'] }] }, 'bar']
    expect(trimStrings(input)).toEqual(expected)
  })

  it('dates pass through', () => {
    const date = new Date('2023-01-01')
    const input = [{ foo: [{ baz: [{ qux: date }] }] }]
    const expected = [{ foo: [{ baz: [{ qux: date }] }] }]
    const result = trimStrings(input)

    expect(result[0].foo[0].baz[0].qux).toBeInstanceOf(Date)
    expect(trimStrings(input)).toEqual(expected)
  })

  it('prisma decimal pass through', () => {
    const decimal = new Prisma.Decimal(1.23)
    const input = [{ foo: [{ baz: [{ qux: decimal }] }] }]
    const expected = [{ foo: [{ baz: [{ qux: decimal }] }] }]

    const result = trimStrings(input)
    expect(result[0].foo[0].baz[0].qux).toBeInstanceOf(Prisma.Decimal)
    expect(trimStrings(input)).toEqual(expected)
  })
})
