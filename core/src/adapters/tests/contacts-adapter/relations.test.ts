import nock from 'nock'

import config from '../../../common/config'
import { makeContactsAdapter } from '../../contacts-adapter'

const adapter = makeContactsAdapter(config.contactsService.url)
const base = config.contactsService.url

const relation = {
  contactCode: 'P000111',
  relatedContactCode: 'P000222',
  roleType: 'god_man' as const,
}

describe('contactsAdapter.addRelation', () => {
  afterEach(() => nock.cleanAll())

  it('posts the body with createdBy and returns the relations on 201', async () => {
    const scope = nock(base)
      .post('/contacts/P000111/relations', {
        relatedContactCode: 'P000222',
        roleType: 'god_man',
        createdBy: 'Anna',
      })
      .reply(201, {
        content: { relations: [{ contactCode: 'P000222', role: 'trustee' }] },
      })

    const result = await adapter.addRelation({ ...relation, createdBy: 'Anna' })

    expect(result).toEqual({
      ok: true,
      data: { relations: [{ contactCode: 'P000222', role: 'trustee' }] },
    })
    scope.done()
  })

  it('passes a known error code and detail through with its status', async () => {
    nock(base)
      .post('/contacts/P000111/relations')
      .reply(409, { error: 'guardian-exists', detail: 'P000444' })

    const result = await adapter.addRelation({ ...relation, createdBy: 'Anna' })

    expect(result).toEqual({
      ok: false,
      err: 'guardian-exists',
      detail: 'P000444',
      statusCode: 409,
    })
  })

  it('maps 400 to invalid-request and unknown failures to contacts-service-error', async () => {
    nock(base)
      .post('/contacts/P000111/relations')
      .reply(400, { error: 'invalid-request-body' })
    expect(
      await adapter.addRelation({ ...relation, createdBy: 'Anna' })
    ).toMatchObject({
      ok: false,
      err: 'invalid-request',
    })

    nock(base).post('/contacts/P000111/relations').reply(500, {})
    expect(
      await adapter.addRelation({ ...relation, createdBy: 'Anna' })
    ).toMatchObject({
      ok: false,
      err: 'contacts-service-error',
    })
  })
})

describe('contactsAdapter.removeRelation', () => {
  afterEach(() => nock.cleanAll())

  it('sends deletedBy as a query parameter and returns ok on 204', async () => {
    const scope = nock(base)
      .delete('/contacts/P000111/relations/god_man/P000222')
      .query({ deletedBy: 'Anna' })
      .reply(204)

    const result = await adapter.removeRelation({
      ...relation,
      deletedBy: 'Anna',
    })

    expect(result).toEqual({ ok: true, data: undefined })
    scope.done()
  })

  it('passes relation-not-found through', async () => {
    nock(base)
      .delete('/contacts/P000111/relations/god_man/P000222')
      .query(true)
      .reply(404, { error: 'relation-not-found' })

    expect(
      await adapter.removeRelation({ ...relation, deletedBy: 'Anna' })
    ).toEqual({
      ok: false,
      err: 'relation-not-found',
      statusCode: 404,
    })
  })
})
