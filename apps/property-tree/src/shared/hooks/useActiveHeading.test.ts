import { resolveActiveId } from './useActiveHeading'

const ids = ['step-1', 'step-2', 'step-3']

// Page taller than the viewport, scrolled nowhere near the bottom.
const midPage = { scrollY: 0, innerHeight: 800, scrollHeight: 3000 }

describe('resolveActiveId', () => {
  it('picks the first intersecting id in document order', () => {
    expect(
      resolveActiveId({
        ids,
        visible: new Set(['step-3', 'step-2']),
        ...midPage,
      })
    ).toBe('step-2')
  })

  it('returns null when nothing intersects, so the previous id stays', () => {
    expect(resolveActiveId({ ids, visible: new Set(), ...midPage })).toBeNull()
  })

  it('pins the last id once the page is scrolled to the bottom', () => {
    expect(
      resolveActiveId({
        ids,
        visible: new Set(['step-1']),
        scrollY: 2200,
        innerHeight: 800,
        scrollHeight: 3000,
      })
    ).toBe('step-3')
  })

  it('treats a sub-pixel gap at the bottom as the bottom', () => {
    expect(
      resolveActiveId({
        ids,
        visible: new Set(['step-1']),
        scrollY: 2198.5,
        innerHeight: 800,
        scrollHeight: 3000,
      })
    ).toBe('step-3')
  })

  it('returns null without ids', () => {
    expect(
      resolveActiveId({ ids: [], visible: new Set(), ...midPage })
    ).toBeNull()
  })

  it('picks the first visible id on a short page, ignoring the bottom rule', () => {
    expect(
      resolveActiveId({
        ids,
        visible: new Set(['step-1']),
        scrollY: 0,
        innerHeight: 800,
        scrollHeight: 600,
      })
    ).toBe('step-1')
  })
})
