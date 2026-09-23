// @vitest-environment jsdom
import { blocksImplicitSubmit } from './implicitSubmit'

const input = (type: string) => {
  const element = document.createElement('input')
  element.type = type
  return element
}

describe('blocksImplicitSubmit', () => {
  it('blocks Enter in single-line text fields', () => {
    expect(blocksImplicitSubmit('Enter', input('text'), false)).toBe(true)
  })

  it('leaves the file picker, textareas and other keys alone', () => {
    expect(blocksImplicitSubmit('Enter', input('file'), false)).toBe(false)
    expect(
      blocksImplicitSubmit('Enter', document.createElement('textarea'), false)
    ).toBe(false)
    expect(
      blocksImplicitSubmit('Enter', document.createElement('div'), false)
    ).toBe(false)
    expect(blocksImplicitSubmit('a', input('text'), false)).toBe(false)
  })

  it('leaves Enter during IME composition alone', () => {
    expect(blocksImplicitSubmit('Enter', input('text'), true)).toBe(false)
  })
})
