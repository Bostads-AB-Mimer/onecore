import { db } from '../../../common/db'
import {
  createTemplate,
  getSystemTemplate,
  getTemplateById,
  listTemplates,
  setTemplateActive,
  TemplateRow,
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
    expect(await updateTemplate(row.id, { body: 'hijacked' })).toBeNull()
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
