import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MarkdownManager } from '@tiptap/markdown'
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { templateExtensions } from './extensions'
import { flattenCell } from './factTable'

// The system email seeds the comms team starts from.
const SEED_DIR = fileURLToPath(
  new URL(
    '../../../../../../../services/communication/migrations/system-email-templates/',
    import.meta.url
  )
)
const seeds = fs
  .readdirSync(SEED_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => [file, fs.readFileSync(path.join(SEED_DIR, file), 'utf8')])

const manager = new MarkdownManager({ extensions: templateExtensions() })
const roundTrip = (markdown: string) =>
  manager.serialize(manager.parse(markdown))

const textNodes = (node: JSONContent): JSONContent[] =>
  node.type === 'text' ? [node] : (node.content ?? []).flatMap(textNodes)

describe('template markdown round trip', () => {
  it('finds all ten seeds', () => {
    expect(seeds).toHaveLength(10)
  })

  it.each(seeds)(
    '%s loads and saves without losing anything',
    (_file, seed) => {
      const doc = manager.parse(seed)
      const saved = manager.serialize(doc)
      expect(manager.parse(saved)).toEqual(doc)
      // Saving again changes nothing, so an untouched template stays put.
      expect(roundTrip(saved)).toBe(saved)
    }
  )

  it('keeps bold and links around placeholders', () => {
    const saved = roundTrip(
      '**Erbjudande på {{address}}.** Svara senast [{{deadlineDate}}]({{offerURL}}).'
    )
    expect(saved).toContain('**Erbjudande på {{address}}.**')
    expect(saved).toContain('[{{deadlineDate}}]({{offerURL}})')
  })

  it('reads a placeholder as a mark on its literal text', () => {
    const [node] = textNodes(manager.parse('**{{firstName}}**')).filter(
      (n) => n.text === '{{firstName}}'
    )
    expect(node.marks?.map((m) => m.type).sort()).toEqual([
      'bold',
      'placeholder',
    ])
    expect(node.marks?.find((m) => m.type === 'placeholder')?.attrs).toEqual({
      token: 'firstName',
    })
  })

  it('keeps a heading and a subheading apart', () => {
    const saved = roundTrip('## Om bilplatsen\n\n### Kontraktet\n\nText')
    expect(saved).toContain('## Om bilplatsen')
    expect(saved).toContain('### Kontraktet')
  })

  it('keeps a button and an image with placeholder addresses', () => {
    const saved = roundTrip(
      '[Tacka ja]({{offerURL}} "button")\n\n![Bilplatsen]({{parkingSpaceImage}})'
    )
    expect(saved).toContain('[Tacka ja]({{offerURL}} "button")')
    expect(saved).toContain('![Bilplatsen]({{parkingSpaceImage}})')
  })

  it.each([
    ['numbered-looking lines', '1\\. Ta med legitimation\n2\\. Kom före 12'],
    ['stars and underscores', 'Pris \\*inkl\\* moms\\_ok'],
    ['a hash at the start', '\\# inte en rubrik'],
    ['a dash list look', '\\- inte en lista'],
  ])('keeps migrated SMS text with %s as text', (_case, body) => {
    const doc = manager.parse(body)
    expect(textNodes(doc).every((n) => !n.marks?.length)).toBe(true)
    expect(manager.parse(roundTrip(body))).toEqual(doc)
  })
})

describe('text typed at a line start', () => {
  it.each([
    '1. Ta med legitimation',
    '12) tolv',
    '- streck',
    '+ plus',
    '* stjärna',
    '# inte en rubrik',
    '> inte ett citat',
    '=== likhetstecken',
    '~~~ tilde',
  ])('keeps %j as text', (text) => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Före' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text },
            { type: 'hardBreak' },
            { type: 'text', text },
          ],
        },
      ],
    }
    expect(manager.parse(manager.serialize(doc))).toEqual(doc)
  })
})

describe('fact table writer', () => {
  it('keeps every cell on one line and escapes pipes', () => {
    expect(flattenCell('A | B')).toBe('A \\| B')
    expect(flattenCell('rad 1  \nrad 2')).toBe('rad 1 rad 2')
    expect(flattenCell('rad 1\\\nrad 2\nrad 3')).toBe('rad 1 rad 2 rad 3')
  })

  it('writes a fact table the renderer reads as two columns', () => {
    const cell = (content: JSONContent[], type = 'tableCell'): JSONContent => ({
      type,
      content: [{ type: 'paragraph', content }],
    })
    const saved = manager.serialize({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [cell([], 'tableHeader'), cell([], 'tableHeader')],
            },
            {
              type: 'tableRow',
              content: [
                cell([{ type: 'text', text: 'A | B' }]),
                cell([
                  { type: 'text', text: 'rad 1' },
                  { type: 'hardBreak' },
                  { type: 'text', text: 'rad 2' },
                ]),
              ],
            },
          ],
        },
      ],
    })
    expect(saved).toContain('A \\| B')
    expect(saved).toContain('rad 1 rad 2')
    expect(saved).not.toContain('<br>')
  })

  it('joins paragraphs made with Enter in a cell with a space, not <br>', () => {
    const paragraph = (text?: string): JSONContent =>
      text
        ? { type: 'paragraph', content: [{ type: 'text', text }] }
        : { type: 'paragraph' }
    const saved = manager.serialize({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [paragraph()] },
                { type: 'tableHeader', content: [paragraph()] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    paragraph('Adress'),
                    paragraph('Test'),
                    paragraph(),
                  ],
                },
                { type: 'tableCell', content: [paragraph('<br> som text')] },
              ],
            },
          ],
        },
      ],
    })
    expect(saved).toMatch(/\| Adress Test\s*\|/)
    expect(saved).not.toMatch(/(?<!\\)<br>/)
    // Typed as text it stays text, escaped.
    expect(manager.parse(saved)).toMatchObject({
      content: [{ type: 'table' }],
    })
    expect(JSON.stringify(manager.parse(saved))).toContain('<br> som text')
  })
})
