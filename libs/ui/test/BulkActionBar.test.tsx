import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BulkActionBar } from '../src'

const button = (name: string | RegExp) =>
  screen.getByRole('button', { name }) as HTMLButtonElement

describe('BulkActionBar', () => {
  it('is hidden without a selection', () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} onClear={() => {}} actions={[]} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows the count, clears, and runs actions', async () => {
    const onClear = vi.fn()
    const publish = vi.fn()
    render(
      <BulkActionBar
        selectedCount={1234}
        onClear={onClear}
        actions={[
          { label: 'Publicera', onClick: publish },
          { label: 'Ta bort', onClick: () => {}, disabled: true },
        ]}
      />
    )

    expect(screen.getByText(/1\s?234 valda/)).toBeTruthy()
    await userEvent.click(button('Publicera'))
    expect(publish).toHaveBeenCalled()
    expect(button('Ta bort').disabled).toBe(true)

    await userEvent.click(button(/Rensa/))
    expect(onClear).toHaveBeenCalled()
  })

  it('disables every action while loading', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onClear={() => {}}
        isLoading
        actions={[{ label: 'Skicka', onClick: () => {} }]}
      />
    )
    expect(button('Skicka').disabled).toBe(true)
  })
})
