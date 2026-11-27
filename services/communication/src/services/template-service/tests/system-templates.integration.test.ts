import { db } from '../../../common/db'
import {
  createTemplate,
  getSystemTemplate,
  getSystemTemplateRecord,
  getTemplateById,
  listSystemTemplates,
  listTemplates,
  setTemplateActive,
  TemplateRow,
  updateSystemTemplate,
  updateTemplate,
} from '../adapters/db'
import {
  SYSTEM_TEMPLATE_KEYS,
  SystemTemplateKey,
  SystemTemplateNotFoundError,
} from '../system-templates'

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

/**
 * Runs against the jest test DB, which globalSetup migrates, so the seeded
 * system templates from 202611251000_add_system_templates.js are present.
 */
const createdIds: string[] = []

afterEach(async () => {
  if (createdIds.length > 0) {
    await db('template').whereIn('id', createdIds).delete()
    createdIds.length = 0
  }
})

describe('getSystemTemplate', () => {
  it.each(SYSTEM_TEMPLATE_KEYS)(
    'returns the seeded %s template',
    async (key) => {
      const template = await getSystemTemplate(key)
      expect(template.systemKey).toBe(key)
      expect(template.subject.trim()).not.toBe('')
      expect(template.body.trim()).not.toBe('')
    }
  )

  it('has the seeded subheadings as headings, not bold text', async () => {
    const offer = await getSystemTemplate('parking_space_offer_replace')
    expect(offer.body).toContain('\n\n## Om bilplatsen\n\n')
    expect(offer.body).not.toContain('**Om bilplatsen**')

    const approved = await getSystemTemplate(
      'non_scored_parking_space_approved'
    )
    for (const title of ['Kontraktet', 'Betala hyran', 'Eventuella nycklar']) {
      expect(approved.body).toContain(`\n\n### ${title}\n\n`)
      expect(approved.body).not.toContain(`**${title}**`)
    }
  })

  it('throws SystemTemplateNotFoundError for an unknown key', async () => {
    // Deliberately outside the key union to reach the not-found path.
    const unknown = 'no_such_template' as SystemTemplateKey
    await expect(getSystemTemplate(unknown)).rejects.toBeInstanceOf(
      SystemTemplateNotFoundError
    )
  })
})

describe('message template routes never see system templates', () => {
  it('listTemplates leaves them out', async () => {
    const all = await listTemplates('all')
    const systemRows =
      await db<TemplateRow>('template').whereNotNull('systemKey')
    const listedIds = new Set(all.map((t) => t.id))
    expect(systemRows.length).toBe(SYSTEM_TEMPLATE_KEYS.length)
    for (const row of systemRows) expect(listedIds.has(row.id)).toBe(false)
  })

  it('getTemplateById returns null for a system template id', async () => {
    const row = await db<TemplateRow>('template')
      .whereNotNull('systemKey')
      .first()
    if (!row) throw new Error('no seeded system template')
    expect(await getTemplateById(row.id)).toBeNull()
  })

  it('updateTemplate and setTemplateActive cannot touch a system template', async () => {
    const row = await db<TemplateRow>('template')
      .whereNotNull('systemKey')
      .first()
    if (!row) throw new Error('no seeded system template')
    expect(
      await updateTemplate(row.id, { body: 'hijacked', revision: row.revision })
    ).toEqual({ ok: false, reason: 'not-found' })
    expect(await setTemplateActive(row.id, false)).toBeNull()
    const after = await db<TemplateRow>('template').where('id', row.id).first()
    expect(after).toMatchObject({ body: row.body, isActive: true })
  })

  it('a rep template may reuse a system template name', async () => {
    const row = await db<TemplateRow>('template')
      .whereNotNull('systemKey')
      .first()
    if (!row) throw new Error('no seeded system template')
    const created = await createTemplate({ name: row.name, body: 'x' })
    createdIds.push(created.id)
    expect(created.name).toBe(row.name)
  })
})

describe('rep template revisions', () => {
  it('bumps the revision on save and rejects a save from an old copy', async () => {
    const created = await createTemplate({
      name: 'Revisionstest',
      body: '**Hej**',
      updatedBy: 'Åsa',
    })
    createdIds.push(created.id)
    expect(created).toMatchObject({
      revision: 1,
      updatedBy: 'Åsa',
      smsText: 'Hej',
    })

    const first = await updateTemplate(created.id, {
      body: 'Ny text',
      revision: 1,
      updatedBy: 'Per',
    })
    expect(first).toMatchObject({
      ok: true,
      template: { body: 'Ny text', revision: 2, updatedBy: 'Per' },
    })

    const stale = await updateTemplate(created.id, {
      body: 'Gammal',
      revision: 1,
    })
    expect(stale).toEqual({ ok: false, reason: 'conflict' })
    expect((await getTemplateById(created.id))?.body).toBe('Ny text')
  })
})

describe('system template records', () => {
  const key: SystemTemplateKey = 'inspection_protocol'
  let original: TemplateRow | undefined

  beforeAll(async () => {
    original = await db<TemplateRow>('template').where('systemKey', key).first()
  })

  afterAll(async () => {
    if (!original) return
    const { subject, body, revision, updatedBy, updatedAt } = original
    await db('template')
      .where('systemKey', key)
      .update({ subject, body, revision, updatedBy, updatedAt })
  })

  it('lists every seeded key', async () => {
    const keys = (await listSystemTemplates()).map((t) => t.key).sort()
    expect(keys).toEqual([...SYSTEM_TEMPLATE_KEYS].sort())
  })

  it('updates at the loaded revision, then rejects the old one', async () => {
    const record = await getSystemTemplateRecord(key)
    if (!record) throw new Error('no seeded system template')

    const saved = await updateSystemTemplate(key, {
      subject: 'Nytt ämne',
      body: 'Hej {{firstName}}!',
      revision: record.revision,
      updatedBy: 'Åsa',
    })
    expect(saved).toMatchObject({
      ok: true,
      template: { subject: 'Nytt ämne', revision: record.revision + 1 },
    })
    // Sends read the saved text straight away.
    expect((await getSystemTemplate(key)).subject).toBe('Nytt ämne')

    const stale = await updateSystemTemplate(key, {
      subject: 'Gammalt',
      body: 'x',
      revision: record.revision,
    })
    expect(stale).toEqual({ ok: false, reason: 'conflict' })
  })
})
