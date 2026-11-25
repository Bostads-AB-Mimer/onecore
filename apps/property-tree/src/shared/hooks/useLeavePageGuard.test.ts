import { describe, expect, it } from 'vitest'

import { shouldBlockNavigation } from './useLeavePageGuard'

const toOtherPage = { currentPathname: '/ekonomi', nextPathname: '/guider' }

describe('shouldBlockNavigation', () => {
  it('lets navigation through when the guard is off', () => {
    expect(
      shouldBlockNavigation({ when: false, allowNext: false, ...toOtherPage })
    ).toBe(false)
  })

  it('blocks a change of page when the guard is on', () => {
    expect(
      shouldBlockNavigation({ when: true, allowNext: false, ...toOtherPage })
    ).toBe(true)
  })

  it('lets a search-param change on the same page through', () => {
    expect(
      shouldBlockNavigation({
        when: true,
        allowNext: false,
        currentPathname: '/ekonomi',
        nextPathname: '/ekonomi',
      })
    ).toBe(false)
  })

  it('lets an allowed programmatic navigation through', () => {
    expect(
      shouldBlockNavigation({ when: true, allowNext: true, ...toOtherPage })
    ).toBe(false)
  })
})
