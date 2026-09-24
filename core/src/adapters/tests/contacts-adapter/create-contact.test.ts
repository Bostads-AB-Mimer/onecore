import { loggedAxios } from '@onecore/utilities'
import type { AxiosInstance } from 'axios'

import config from '../../../common/config'
import { makeContactsAdapter } from '../../contacts-adapter'

// The contacts service's own Xpand SOAP timeout, with database work before and
// after it. Giving up sooner reports a failure for a create that landed.
const SERVICE_SOAP_TIMEOUT_MS = 30_000

describe('contactsAdapter.createContact', () => {
  afterEach(() => jest.restoreAllMocks())

  it('waits clearly longer than the service SOAP timeout, since a create cannot be undone', async () => {
    const realCreate = loggedAxios.create.bind(loggedAxios)
    let instance: AxiosInstance | undefined
    jest.spyOn(loggedAxios, 'create').mockImplementation((cfg) => {
      instance = realCreate(cfg)
      return instance
    })
    const adapter = makeContactsAdapter(config.contactsService.url)
    const postSpy = jest
      .spyOn(instance!, 'post')
      .mockResolvedValue({ status: 201, data: { content: {} } })

    await adapter.createContact({} as any)

    const timeout = postSpy.mock.calls[0][2]?.timeout
    expect(timeout).toBeGreaterThanOrEqual(2 * SERVICE_SOAP_TIMEOUT_MS)
  })
})
