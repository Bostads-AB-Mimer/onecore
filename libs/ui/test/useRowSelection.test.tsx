import { act, renderHook } from '@testing-library/react'

import { useRowSelection } from '../src'

type Row = { id: string; name: string }

const page1: Row[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
]
const page2: Row[] = [{ id: 'c', name: 'C' }]
const wide: Row[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
  id,
  name: id.toUpperCase(),
}))

const getId = (row: Row) => row.id

const setup = (rows: Row[] = page1, totalCount?: number) =>
  renderHook(
    ({ rows }: { rows: Row[] }) => useRowSelection(rows, getId, { totalCount }),
    { initialProps: { rows } }
  )

describe('useRowSelection', () => {
  describe('include mode', () => {
    it('starts empty', () => {
      const { result } = setup()
      expect(result.current.mode).toBe('include')
      expect(result.current.count).toBe(0)
      expect(result.current.pageState).toBe('none')
      expect(result.current.isSelected('a')).toBe(false)
      expect(result.current.target).toEqual({
        mode: 'include',
        ids: [],
        rows: [],
      })
    })

    it('toggles a row and keeps the row itself', () => {
      const { result } = setup()

      act(() => result.current.toggle('a'))
      expect(result.current.selectedRows).toEqual([page1[0]])
      expect(result.current.target).toEqual({
        mode: 'include',
        ids: ['a'],
        rows: [page1[0]],
      })
      expect(result.current.pageState).toBe('some')

      act(() => result.current.toggle('a'))
      expect(result.current.count).toBe(0)
    })

    it('ignores an id that is neither selected nor on the page', () => {
      const { result } = setup()
      act(() => result.current.toggle('zzz'))
      expect(result.current.count).toBe(0)
    })

    it('togglePage ticks the page, then unticks it when fully ticked', () => {
      const { result } = setup()

      act(() => result.current.togglePage())
      expect(result.current.pageState).toBe('all')
      expect(result.current.target).toMatchObject({ ids: ['a', 'b'] })

      act(() => result.current.togglePage())
      expect(result.current.pageState).toBe('none')
    })

    it('togglePage completes a partial page instead of clearing it', () => {
      const { result } = setup()
      act(() => result.current.toggle('a'))
      act(() => result.current.togglePage())
      expect(result.current.target).toMatchObject({ ids: ['a', 'b'] })
    })

    it('keeps earlier pages while togglePage only touches the current one', () => {
      const { result, rerender } = setup()
      act(() => result.current.togglePage())

      rerender({ rows: page2 })
      expect(result.current.pageState).toBe('none')
      expect(result.current.count).toBe(2)

      act(() => result.current.togglePage())
      expect(result.current.count).toBe(3)

      act(() => result.current.togglePage())
      expect(result.current.target).toMatchObject({ ids: ['a', 'b'] })
    })

    it('keeps callbacks stable across selection changes', () => {
      const { result } = setup()
      const { toggle, togglePage, clear, selectAllResults } = result.current
      act(() => result.current.toggle('a'))
      expect(result.current.toggle).toBe(toggle)
      expect(result.current.togglePage).toBe(togglePage)
      expect(result.current.clear).toBe(clear)
      expect(result.current.selectAllResults).toBe(selectAllResults)
    })

    it('set replaces the selection and clear empties it', () => {
      const { result } = setup()
      act(() => result.current.toggle('a'))
      act(() => result.current.set(page2))
      expect(result.current.target).toMatchObject({ ids: ['c'] })

      act(() => result.current.clear())
      expect(result.current.count).toBe(0)
    })
  })

  describe('shift-click ranges', () => {
    it('selects the gap between the last click and the target, both included', () => {
      const { result } = setup(wide)
      act(() => result.current.toggle('b'))
      act(() => result.current.toggleRange('d'))
      expect(result.current.target).toMatchObject({ ids: ['b', 'c', 'd'] })
    })

    it('works upwards too', () => {
      const { result } = setup(wide)
      act(() => result.current.toggle('d'))
      act(() => result.current.toggleRange('b'))
      expect(result.current.target).toMatchObject({ ids: ['d', 'b', 'c'] })
    })

    it('unselects the range when the target is already selected', () => {
      const { result } = setup(wide)
      act(() => result.current.togglePage())
      act(() => result.current.toggle('b'))
      act(() => result.current.toggle('b'))
      act(() => result.current.toggleRange('d'))
      expect(result.current.target).toMatchObject({ ids: ['a', 'e'] })
    })

    it('chains: the target becomes the next anchor', () => {
      const { result } = setup(wide)
      act(() => result.current.toggle('a'))
      act(() => result.current.toggleRange('c'))
      act(() => result.current.toggleRange('e'))
      expect(result.current.count).toBe(5)
    })

    it('falls back to the target alone when the anchor left the page', () => {
      const { result, rerender } = setup(page1)
      act(() => result.current.toggle('a'))
      rerender({ rows: wide.slice(2) })
      act(() => result.current.toggleRange('e'))
      expect(result.current.target).toMatchObject({ ids: ['a', 'e'] })
    })

    it('excludes a range in exclude mode', () => {
      const { result } = setup(wide, 50)
      act(() => result.current.selectAllResults())
      act(() => result.current.toggle('b'))
      act(() => result.current.toggleRange('d'))
      expect(result.current.target).toMatchObject({
        excludedIds: ['b', 'c', 'd'],
      })
      expect(result.current.count).toBe(47)
    })
  })

  describe('exclude mode', () => {
    it('selectAllResults switches mode and counts the total', () => {
      const { result } = setup(page1, 40)

      act(() => result.current.selectAllResults())
      expect(result.current.mode).toBe('exclude')
      expect(result.current.count).toBe(40)
      expect(result.current.pageState).toBe('all')
      expect(result.current.isSelected('not-on-any-page')).toBe(true)
      expect(result.current.target).toEqual({
        mode: 'exclude',
        excludedIds: [],
        excludedRows: [],
      })
      expect(result.current.selectedRows).toEqual(page1)
    })

    it('unticking a row on another page excludes it and stays in the mode', () => {
      const { result, rerender } = setup(page1, 40)
      act(() => result.current.selectAllResults())

      rerender({ rows: page2 })
      act(() => result.current.toggle('c'))

      expect(result.current.mode).toBe('exclude')
      expect(result.current.count).toBe(39)
      expect(result.current.isSelected('c')).toBe(false)
      expect(result.current.isSelected('a')).toBe(true)
      expect(result.current.pageState).toBe('none')
      expect(result.current.target).toEqual({
        mode: 'exclude',
        excludedIds: ['c'],
        excludedRows: page2,
      })
      expect(result.current.selectedRows).toEqual(page1)

      act(() => result.current.toggle('c'))
      expect(result.current.count).toBe(40)
      expect(result.current.target).toMatchObject({ excludedIds: [] })
    })

    it('togglePage excludes the whole page, then includes it again', () => {
      const { result } = setup(page1, 40)
      act(() => result.current.selectAllResults())

      act(() => result.current.togglePage())
      expect(result.current.pageState).toBe('none')
      expect(result.current.count).toBe(38)
      expect(result.current.selectedRows).toEqual([])

      act(() => result.current.togglePage())
      expect(result.current.pageState).toBe('all')
      expect(result.current.count).toBe(40)
    })

    it('clear and set return to include mode', () => {
      const { result } = setup(page1, 40)

      act(() => result.current.selectAllResults())
      act(() => result.current.clear())
      expect(result.current.mode).toBe('include')
      expect(result.current.count).toBe(0)

      act(() => result.current.selectAllResults())
      act(() => result.current.set(page2))
      expect(result.current.mode).toBe('include')
      expect(result.current.target).toMatchObject({ ids: ['c'] })
    })

    it('falls back to the rows seen without a totalCount', () => {
      const { result } = setup(page1)
      act(() => result.current.selectAllResults())
      expect(result.current.count).toBe(2)
    })
  })
})
