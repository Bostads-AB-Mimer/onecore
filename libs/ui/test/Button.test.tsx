import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Button } from '../src'

describe('Button', () => {
  it('renders its label and handles clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Spara</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies the variant classes', () => {
    render(<Button variant="destructive">Ta bort</Button>)

    expect(screen.getByRole('button').className).toContain('bg-destructive')
  })
})
