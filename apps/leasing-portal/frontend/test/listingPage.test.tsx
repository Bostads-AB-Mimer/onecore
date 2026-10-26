import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'

import { leasingRoutes } from '../src/pages/routes'
import { bffUrl, TestHost } from './testUtils'

const listing = {
  id: 42,
  status: 1,
  publishedTo: '2026-09-30T00:00:00.000Z',
  rentalObjectCode: '234-234-234-1009',
  address: 'Järnvägsgatan 28',
  areaName: 'Malmaberg',
  tenureType: { id: 'STD', name: 'Standard hyresobjektstyp' },
  roomCount: 3,
  size: 78,
  floor: '4',
  rent: 10200,
  vacantFrom: '2026-11-01T00:00:00.000Z',
  activeApplicantCount: 15,
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

const renderAt = (url: string, state?: unknown) => {
  const router = createMemoryRouter(
    [
      {
        path: '/uthyrning',
        element: (
          <TestHost>
            <Outlet />
          </TestHost>
        ),
        children: leasingRoutes,
      },
    ],
    { initialEntries: [{ pathname: url, state }] }
  )
  render(<RouterProvider router={router} />)
}

const url = '/uthyrning/bostad/poangsatt/annons/42'
const field = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent

afterEach(() => vi.unstubAllGlobals())

describe('ListingPage', () => {
  it('shows the object information from the BFF', async () => {
    const calls = stubFetch(json({ content: listing }))

    renderAt(url)

    expect(
      await screen.findByRole('heading', { name: 'Järnvägsgatan 28' })
    ).toBeTruthy()
    expect(calls[0].url).toBe(`${bffUrl}/bostad/listings/42`)
    expect(field('Lägenhet')).toBe('Järnvägsgatan 28234-234-234-1009')
    expect(field('Område')).toBe('Malmaberg')
    expect(field('Lägenhetstyp')).toBe('Standard')
    expect(field('Antal rum')).toBe('3')
    expect(field('Storlek')).toBe('78 m²')
    expect(field('Våning')).toBe('4')
    expect(field('Hyra')).toMatch(/^10\s200 kr\/mån$/)
    expect(field('Sökande')).toBe('15')
    expect(field('Publicerad t.o.m.')).toBe('2026-09-30')
    expect(field('Ledig från och med')).toBe('2026-11-01')
    expect(
      screen
        .getByRole('link', { name: 'Visa annons på Mimer.nu' })
        .getAttribute('href')
    ).toBe('https://www.mimer.nu/sok-ledigt/lediga-lagenheter/234-234-234-1009')
  })

  it('shows a dash for values Tenfast did not give', async () => {
    stubFetch(
      json({
        content: {
          ...listing,
          tenureType: null,
          rent: null,
          vacantFrom: null,
          floor: null,
        },
      })
    )

    renderAt(url)
    await screen.findByRole('heading', { name: 'Järnvägsgatan 28' })

    expect(field('Lägenhetstyp')).toBe('–')
    expect(field('Hyra')).toBe('–')
    expect(field('Ledig från och med')).toBe('–')
    expect(field('Våning')).toBe('–')
  })

  it('marks the tab for the listing’s stage and goes back to that list', async () => {
    stubFetch(json({ content: listing }))

    renderAt(url)
    await screen.findByRole('heading', { name: 'Järnvägsgatan 28' })

    // The tab and the status badge by the heading.
    expect(screen.getAllByText('Publicerat nu')).toHaveLength(2)
    expect(
      screen
        .getByRole('link', { name: 'Publicerat nu' })
        .getAttribute('aria-current')
    ).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Tillbaka' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/poangsatt/publicerat-nu')
  })

  it('follows the listing when it has moved on since the link was shared', async () => {
    stubFetch(json({ content: { ...listing, status: 4 } }))

    renderAt(url)
    await screen.findByRole('heading', { name: 'Järnvägsgatan 28' })

    expect(
      screen
        .getByRole('link', { name: 'Erbjud visning' })
        .getAttribute('aria-current')
    ).toBe('page')
    expect(
      screen.getByRole('link', { name: 'Tillbaka' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/poangsatt/erbjud-visning')
  })

  it('goes back to the list that linked here', async () => {
    stubFetch(json({ content: listing }))

    renderAt(url, {
      from: '/uthyrning/bostad/poangsatt/publicerat-nu?sok=jarnvag',
    })
    await screen.findByRole('heading', { name: 'Järnvägsgatan 28' })

    expect(
      screen.getByRole('link', { name: 'Tillbaka' }).getAttribute('href')
    ).toBe('/uthyrning/bostad/poangsatt/publicerat-nu?sok=jarnvag')
  })

  it('says so when the listing does not exist', async () => {
    stubFetch(json({ error: 'Listing not found' }, 404))

    renderAt(url)

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Annonsen finns inte.'
    )
  })

  it('words other BFF failures for the user', async () => {
    stubFetch(json({ error: 'core-unavailable' }, 502))

    renderAt(url)

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Kunde inte nå uthyrningstjänsten.'
    )
  })
})
