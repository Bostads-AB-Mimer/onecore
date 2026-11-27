import { readSeedTemplates } from '../seed-templates'

// The migration is plain JS; these are the functions it exports besides up/down.
const {
  toHeadings,
  toBoldText,
}: {
  toHeadings: (body: string) => string
  toBoldText: (body: string) => string
} = require('../../../../migrations/202611271000_system_template_subheadings')

const seeds = readSeedTemplates()
const seedBody = (key: string) => {
  const seed = seeds.find((s) => s.systemKey === key)
  if (!seed) throw new Error(`no seed for ${key}`)
  return seed.body
}

describe('subheadings migration', () => {
  it('turns the approved email subheadings into headings above their text', () => {
    const body = toHeadings(seedBody('non_scored_parking_space_approved'))
    expect(body).toContain('\n\n### Kontraktet\n\nDu kommer snart')
    expect(body).toContain('\n\n### Betala hyran\n\nBilplatsen betalas')
    expect(body).toContain('\n\n### Eventuella nycklar\n\nOm det behövs')
    expect(body).toContain('\n\n## Om bilplatsen\n\n|')
    expect(body).not.toMatch(/\*\*(Kontraktet|Betala hyran|Om bilplatsen)/)
  })

  it('leaves the bold signature and bold lead sentences alone', () => {
    const body = toHeadings(seedBody('parking_space_offer_replace'))
    expect(body).toContain('Med vänlig hälsning\n**Mimer**')
    expect(body).toContain('**Du har valt att byta bilplats.** Tackar du ja')
  })

  it.each(seeds.map((s) => s.systemKey))(
    '%s comes back unchanged on the way down',
    (key) => {
      const body = seedBody(key)
      expect(toBoldText(toHeadings(body))).toBe(body)
    }
  )
})
