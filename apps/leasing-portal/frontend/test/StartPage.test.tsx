import { render, screen } from '@testing-library/react'

import { StartPage } from '../src/pages/StartPage'
import { bffUrl, stubProfileFetch, TestHost } from './testUtils'

describe('StartPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the host user and the profile fetched from the BFF with credentials', async () => {
    const fetchMock = stubProfileFetch()

    render(
      <TestHost>
        <StartPage />
      </TestHost>
    )

    expect(screen.getByRole('heading', { name: 'Uthyrning' })).toBeTruthy()
    expect(screen.getByText('Test Testsson')).toBeTruthy()
    expect(await screen.findByText('test@example.com')).toBeTruthy()

    const [request] = fetchMock.mock.calls[0] as [Request]
    expect(request.url).toBe(`${bffUrl}/auth/profile`)
    expect(request.credentials).toBe('include')
  })

  it('tells the user when the BFF cannot be reached', async () => {
    stubProfileFetch({ error: 'core-unavailable' }, 502)

    render(
      <TestHost>
        <StartPage />
      </TestHost>
    )

    expect(
      await screen.findByText('Kunde inte nå uthyrningstjänsten.')
    ).toBeTruthy()
  })
})
