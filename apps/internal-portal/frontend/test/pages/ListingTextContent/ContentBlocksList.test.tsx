import { describe, expect, it } from 'vitest'
import { useState } from 'react'

import { render, screen, userEvent } from '../../setup/test.utils'
import { ContentBlocksList } from '@/pages/ListingTextContent/components/ContentBlocksList'
import type { ContentBlock } from '@/pages/ListingTextContent/components/ContentBlockEditor'

const initialBlocks: ContentBlock[] = [
  { id: 'b1', type: 'headline', content: 'Rubrik' },
  { id: 'b2', type: 'text', content: 'Brödtext' },
  { id: 'b3', type: 'text', content: '' },
]

// Stateful host so the list's onBlocksChange round-trips like in the forms.
const Host = ({
  blocks: initial = initialBlocks,
  validationAttempt = 0,
}: {
  blocks?: ContentBlock[]
  validationAttempt?: number
}) => {
  const [blocks, setBlocks] = useState(initial)
  return (
    <ContentBlocksList
      blocks={blocks}
      onBlocksChange={setBlocks}
      validationAttempt={validationAttempt}
    />
  )
}

const collapseButtons = () =>
  screen.queryAllByRole('button', { name: 'Minimera block' })
const expandButtons = () =>
  screen.queryAllByRole('button', { name: 'Expandera block' })

describe('ContentBlocksList', () => {
  it('renders every block expanded initially', () => {
    render(<Host />)

    expect(collapseButtons()).toHaveLength(3)
    expect(expandButtons()).toHaveLength(0)
  })

  it('collapses and expands a single block', async () => {
    render(<Host />)

    await userEvent.click(collapseButtons()[1])
    expect(expandButtons()).toHaveLength(1)
    expect(screen.getByText('Brödtext')).toBeInTheDocument()

    await userEvent.click(expandButtons()[0])
    expect(expandButtons()).toHaveLength(0)
  })

  it('collapses and expands all blocks with the header button', async () => {
    render(<Host />)

    await userEvent.click(screen.getByRole('button', { name: 'Minimera alla' }))
    expect(expandButtons()).toHaveLength(3)
    expect(screen.getByText('Tomt block')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Expandera alla' })
    )
    expect(collapseButtons()).toHaveLength(3)
  })

  it('hides the collapse-all button with a single block', () => {
    render(<Host blocks={[initialBlocks[0]]} />)

    expect(screen.queryByRole('button', { name: 'Minimera alla' })).toBeNull()
  })

  it('adds new blocks expanded while others stay collapsed', async () => {
    render(<Host />)

    await userEvent.click(screen.getByRole('button', { name: 'Minimera alla' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lägg till' }))

    expect(expandButtons()).toHaveLength(3)
    expect(collapseButtons()).toHaveLength(1)
  })

  it('expands invalid blocks after a failed save attempt', async () => {
    const { rerender } = render(<Host />)

    await userEvent.click(screen.getByRole('button', { name: 'Minimera alla' }))
    expect(expandButtons()).toHaveLength(3)

    rerender(<Host validationAttempt={1} />)

    // Only the empty third block is expanded; valid blocks stay minimized.
    expect(expandButtons()).toHaveLength(2)
    expect(collapseButtons()).toHaveLength(1)
    expect(screen.getByText('Innehåll krävs')).toBeInTheDocument()
  })

  it('re-expands an invalid block on every failed save attempt', async () => {
    const { rerender } = render(<Host validationAttempt={1} />)

    // The user may minimize the flagged block again after the first attempt.
    await userEvent.click(screen.getByRole('button', { name: 'Minimera alla' }))
    expect(expandButtons()).toHaveLength(3)

    rerender(<Host validationAttempt={2} />)

    expect(expandButtons()).toHaveLength(2)
    expect(collapseButtons()).toHaveLength(1)
  })
})
