import nock from 'nock'

import config from '../../../common/config'
import { makeContactsAdapter } from '../../contacts-adapter'

const adapter = makeContactsAdapter(config.contactsService.url)
const base = config.contactsService.url
const nid = '199007292387'
const path = `/contacts/by-nid/${nid}/person-contacts`

beforeAll(() => nock.disableNetConnect())
afterAll(() => nock.enableNetConnect())
afterEach(() => nock.cleanAll())

describe('contactsAdapter.getPersonContactsByNationalId', () => {
  it('returns the contacts in the order the service gives them', async () => {
    const contacts = [
      { contactCode: 'P2', isActive: false },
      { contactCode: 'P1', isActive: true },
    ]
    const scope = nock(base)
      .get(path)
      .reply(200, { _links: {}, content: { contacts } })

    await expect(adapter.getPersonContactsByNationalId(nid)).resolves.toEqual({
      ok: true,
      data: contacts,
    })
    scope.done()
  })

  it('returns an empty list when the person has no contacts', async () => {
    nock(base)
      .get(path)
      .reply(200, { _links: {}, content: { contacts: [] } })

    await expect(adapter.getPersonContactsByNationalId(nid)).resolves.toEqual({
      ok: true,
      data: [],
    })
  })

  it("answers 'invalid-national-id' on 400", async () => {
    nock(base).get(path).reply(400, { error: 'invalid-national-id' })

    await expect(
      adapter.getPersonContactsByNationalId(nid)
    ).resolves.toMatchObject({ ok: false, err: 'invalid-national-id' })
  })

  it("answers 'contacts-service-error' on any other status", async () => {
    nock(base).get(path).reply(500, { errorMessage: 'boom' })

    await expect(
      adapter.getPersonContactsByNationalId(nid)
    ).resolves.toMatchObject({
      ok: false,
      err: 'contacts-service-error',
      statusCode: 500,
    })
  })

  it("answers 'contacts-service-error' when the body breaks the contract", async () => {
    nock(base)
      .get(path)
      .reply(200, { content: { contacts: [{ contactCode: 'P1' }] } })

    await expect(
      adapter.getPersonContactsByNationalId(nid)
    ).resolves.toMatchObject({ ok: false, err: 'contacts-service-error' })
  })

  it("answers 'contacts-service-error' without a response at all", async () => {
    nock(base).get(path).replyWithError({ code: 'ECONNRESET' })

    await expect(adapter.getPersonContactsByNationalId(nid)).resolves.toEqual({
      ok: false,
      err: 'contacts-service-error',
    })
  })
})
