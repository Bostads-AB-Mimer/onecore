import { describe, expect, it, vi } from 'vitest'

import { render, screen, userEvent } from '../../setup/test.utils'
import {
  ContentBlock,
  ContentBlockEditor,
} from '@/pages/ListingTextContent/components/ContentBlockEditor'

const textBlock: ContentBlock = {
  id: 'b1',
  type: 'text',
  content: 'Första raden\nAndra raden',
}

const renderEditor = (
  block: ContentBlock,
  props: Partial<React.ComponentProps<typeof ContentBlockEditor>> = {}
) => {
  const onToggleCollapsed = vi.fn()
  render(
    <ContentBlockEditor
      block={block}
      index={0}
      onUpdate={() => {}}
      onDelete={() => {}}
      onToggleCollapsed={onToggleCollapsed}
      {...props}
    />
  )
  return { onToggleCollapsed }
}

describe('ContentBlockEditor', () => {
  it('shows the edit fields when expanded', () => {
    renderEditor(textBlock)

    expect(screen.getByRole('textbox')).toHaveValue(textBlock.content)
    expect(
      screen.getByRole('button', { name: 'Minimera block' })
    ).toBeInTheDocument()
  })

  it('shows type label and a one-line summary when collapsed', () => {
    renderEditor(textBlock, { collapsed: true })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Text')).toBeInTheDocument()
    expect(screen.getByText('Första raden Andra raden')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expandera block' })
    ).toBeInTheDocument()
  })

  it('flags a collapsed empty text block even without showEmptyError', () => {
    renderEditor(
      { id: 'b2', type: 'headline', content: '' },
      { collapsed: true }
    )

    expect(screen.getByText('Tomt block')).toBeInTheDocument()
  })

  it('flags a collapsed incomplete link block', () => {
    renderEditor(
      { id: 'b3', type: 'link', name: 'Visning', url: '' },
      { collapsed: true }
    )

    expect(screen.getByText('Ofullständig länk')).toBeInTheDocument()
  })

  it('summarizes a link block by its name', () => {
    renderEditor(
      { id: 'b4', type: 'link', name: 'Visning', url: 'https://a.se' },
      { collapsed: true }
    )

    expect(screen.getByText('Visning')).toBeInTheDocument()
  })

  it('calls onToggleCollapsed from the toggle button', async () => {
    const { onToggleCollapsed } = renderEditor(textBlock)

    await userEvent.click(
      screen.getByRole('button', { name: 'Minimera block' })
    )

    expect(onToggleCollapsed).toHaveBeenCalledWith('b1')
  })

  it('calls onToggleCollapsed when the collapsed summary is clicked', async () => {
    const { onToggleCollapsed } = renderEditor(textBlock, { collapsed: true })

    await userEvent.click(screen.getByText('Första raden Andra raden'))

    expect(onToggleCollapsed).toHaveBeenCalledWith('b1')
  })

  it('hides the toggle button when no handler is given', () => {
    renderEditor(textBlock, { onToggleCollapsed: undefined })

    expect(screen.queryByRole('button', { name: 'Minimera block' })).toBeNull()
  })
})
