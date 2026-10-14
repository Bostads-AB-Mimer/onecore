import { safeReturnTo } from '../src'

const origin = 'https://app.example'

describe('safeReturnTo', () => {
  it.each([
    ['/', '/'],
    ['/uthyrning/bostad', '/uthyrning/bostad'],
    ['/sok?q=a#rad-2', '/sok?q=a#rad-2'],
  ])('keeps the internal path %s', (input, expected) => {
    expect(safeReturnTo(input, origin)).toBe(expected)
  })

  it.each([
    ['protocol-relative', '//evil.example'],
    ['backslash', '/\\evil.example'],
    ['tab inside the slashes', '/\t/evil.example'],
    ['dot segment before //', '/.//evil.example'],
    ['parent segment before //', '/..//evil.example'],
    ['segment undone before //', '/a/..//evil.example'],
    ['dot segment before backslash', '/./\\evil.example'],
    ['encoded dot segment', '/.%2e//evil.example'],
    ['triple slash after normalising', '/x/../\\/evil.example'],
    ['absolute URL', 'https://evil.example/'],
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'bostad'],
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to / for %s', (_, input) => {
    expect(safeReturnTo(input, origin)).toBe('/')
  })
})
