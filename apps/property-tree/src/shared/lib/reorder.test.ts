import { moveItem } from './reorder'

describe('moveItem', () => {
  it('moves an item forward and backward', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns the same list for a no-op or out-of-range move', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 1, 1)).toBe(list)
    expect(moveItem(list, -1, 0)).toBe(list)
    expect(moveItem(list, 0, 5)).toBe(list)
  })

  it('does not mutate the input', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 1)
    expect(list).toEqual(['a', 'b', 'c'])
  })
})
