import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { renderEmail, SYSTEM_TEMPLATE_KEYS } from '../system-templates'
import { SYSTEM_EMAIL_FIXTURES } from '../system-email-fixtures'
import { readSeedTemplates } from '../seed-templates'

describe('renderEmail', () => {
  it('fills the subject and wraps the body in the template footer', () => {
    const rendered = renderEmail(
      {
        systemKey: 'work_order',
        subject: 'Ärende {{code}}',
        body: 'Hej {{name}}',
      },
      { code: '42', name: 'Åsa' }
    )
    expect(rendered.subject).toBe('Ärende 42')
    expect(rendered.html).toContain('Hej Åsa')
    // work_order uses the contact footer.
    expect(rendered.text).toContain(
      'Dataskydd och hantering av personuppgifter'
    )
    // The communication log stores the message without the footer.
    expect(rendered.bodyText).toBe('Hej Åsa')
  })

  it('adds no footer for lease termination', () => {
    const rendered = renderEmail(
      {
        systemKey: 'lease_termination_confirmation',
        subject: 'S',
        body: 'Hej',
      },
      {}
    )
    expect(rendered.text).toBe('Hej')
  })
})

describe('seed templates', () => {
  const seeds = readSeedTemplates()

  it('has exactly one seed per system key', () => {
    expect(seeds.map((s) => s.systemKey).sort()).toEqual(
      [...SYSTEM_TEMPLATE_KEYS].sort()
    )
  })

  it.each(SYSTEM_TEMPLATE_KEYS)('%s renders with its fixture', (key) => {
    const seed = seeds.find((s) => s.systemKey === key)
    if (!seed) throw new Error(`no seed for ${key}`)
    const rendered = renderEmail(seed, SYSTEM_EMAIL_FIXTURES[key])
    expect(rendered.subject).not.toBe('')
    expect(rendered.html).not.toContain('{{')
    expect(rendered.text).not.toContain('{{')
  })

  it('rejects a seed index entry without a name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'))
    fs.writeFileSync(
      path.join(dir, 'index.json'),
      JSON.stringify([{ systemKey: 'work_order', subject: 'S' }])
    )
    fs.writeFileSync(path.join(dir, 'work_order.md'), 'x')
    expect(() => readSeedTemplates(dir)).toThrow(/name/)
  })

  it('contains no Infobip tags or raw HTML', () => {
    for (const seed of seeds) {
      expect(seed.body).not.toContain('{$')
      expect(seed.body).not.toMatch(/<[a-z]/i)
    }
  })
})
