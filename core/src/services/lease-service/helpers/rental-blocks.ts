import { property } from '@onecore/types'

type Block = Pick<property.RentalBlock, 'fromDate' | 'toDate'>

/**
 * The rental block that decides when an object can be let: one without an
 * end date wins, otherwise the one ending last, like the ROW_NUMBER pick in
 * leasing's Xpand query for parking spaces. Unlike that query (until
 * AVTAL-354), a block without a reason counts: the reason only describes it.
 */
export const governingBlock = <T extends Block>(blocks: T[]): T | undefined =>
  blocks.find((block) => block.toDate === null) ??
  [...blocks].sort(
    (a, b) => (b.toDate?.getTime() ?? 0) - (a.toDate?.getTime() ?? 0)
  )[0]
