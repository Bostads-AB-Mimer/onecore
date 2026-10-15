import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { BostadPage } from '../src/pages/BostadPage'
import { bffUrl, TestHost } from './testUtils'

const apartment = {
  rentalObjectCode: '123-456-01-0101',
  address: {
    street: 'Trädgårdsgatan 19',
    street2: null,
    postalCode: '722 12',
    city: 'Västerås',
  },
  apartmentNumber: '1203',
  propertyCode: '123-456',
  propertyName: 'LINDAREN 2',
  buildingCode: '123-456-01',
  marketAreaCode: 'VAS',
  marketAreaName: 'Vasastan',
  residenceTypeName: '4 rum och kök',
  roomCount: 4,
  floor: '4',
  elevator: true,
  area: 102,
  rent: 14200,
  rentalTenureType: { id: 'STD', name: 'Standard' },
  rentalTags: [{ id: 'POÄNGFRITT', name: 'Poängfritt' }],
  vacantFrom: '2026-10-22T00:00:00.000Z',
  block: null,
  listing: null,
  closedListingsSinceLastLease: 2,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const stubFetch = (response: Response) => {
  const calls: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      calls.push(input instanceof Request ? input : new Request(input, init))
      return response
    })
  )
  return calls
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/uthyrning/bostad']}>
      <TestHost>
        <BostadPage />
      </TestHost>
    </MemoryRouter>
  )

afterEach(() => vi.unstubAllGlobals())

describe('BostadPage', () => {
  it('lists the vacant apartments from the BFF', async () => {
    const calls = stubFetch(
      json({
        content: [
          apartment,
          {
            ...apartment,
            rentalObjectCode: '123-456-01-0102',
            listing: {
              id: 1,
              rentalObjectCode: '123-456-01-0102',
              status: 5,
              rentalRule: 'SCORED',
              listingCategory: 'APARTMENT',
              reviewedAt: '2026-10-01T08:00:00.000Z',
              reviewedBy: 'albin',
            },
          },
        ],
      })
    )

    renderPage()

    expect(await screen.findAllByText('Trädgårdsgatan 19')).toHaveLength(2)
    expect(calls[0].url).toBe(`${bffUrl}/bostad/vacant-apartments`)
    expect(screen.getByText('Ingen annons')).toBeTruthy()
    expect(screen.getByText('Redo att publicera')).toBeTruthy()
    expect(screen.getAllByText('Vasastan')).toHaveLength(2)
    expect(screen.getAllByText('Standard')).toHaveLength(2)
    expect(screen.getAllByText('Poängfritt')).toHaveLength(2)
    expect(screen.getAllByText('14 200 kr/mån')).toHaveLength(2)
  })

  it('selects rows and shows the bulk action bar', async () => {
    stubFetch(
      json({
        content: [
          apartment,
          { ...apartment, rentalObjectCode: '123-456-01-0102' },
        ],
      })
    )

    renderPage()
    await screen.findAllByText('Trädgårdsgatan 19')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Välj alla' }))
    expect(screen.getByText('2 valda')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Rensa/ }))
    expect(screen.queryByText('2 valda')).toBeNull()
  })

  it('shows an empty state', async () => {
    stubFetch(json({ content: [] }))

    renderPage()

    expect(
      await screen.findByText('Inga lediga lägenheter att publicera')
    ).toBeTruthy()
  })

  it('words a BFF failure for the user', async () => {
    stubFetch(json({ error: 'get-availabilities-failed' }, 502))

    renderPage()

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Kunde inte nå uthyrningstjänsten.'
    )
  })
})
