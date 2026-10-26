import { fireEvent, render, screen } from '@testing-library/react'

import { FloorplanImage } from '../src'

describe('FloorplanImage', () => {
  it('loads the floorplan from the public CDN by rental id', () => {
    render(<FloorplanImage rentalId="211-001-01-0101" />)

    expect(screen.getByAltText('Planritning').getAttribute('src')).toBe(
      'https://pub.mimer.nu/bofaktablad/bofaktablad/211-001-01-0101.jpg'
    )
  })

  it('shows an empty state when the residence has no floorplan', () => {
    render(<FloorplanImage rentalId="211-001-01-0101" />)

    fireEvent.error(screen.getByAltText('Planritning'))

    expect(screen.getByText('Planritning inte tillgänglig')).toBeTruthy()
    expect(screen.queryByAltText('Planritning')).toBeNull()
  })

  it('shows the empty state without a rental id', () => {
    render(<FloorplanImage />)

    expect(screen.getByText('Planritning inte tillgänglig')).toBeTruthy()
  })
})
