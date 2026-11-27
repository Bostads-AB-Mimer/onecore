import { markdownToText } from '../render/render'

// The migration is plain JS; this is the one function it exports besides up/down.
const {
  escapePlainText,
}: {
  escapePlainText: (text: string) => string
} = require('../../../../migrations/202611261000_template_revision_and_markdown_bodies')

// What markdown can't keep anyway: trailing spaces, extra blank lines.
const normalise = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

describe('escapePlainText (rep template migration)', () => {
  it.each([
    'Hej! Din nyckel finns att hämta på kundcenter.',
    '1. Ta med legitimation\n2. Kom före kl. 12',
    '12) tolv\nPris 12.30 kr',
    '- streck\n* stjärna\n+ plus',
    '*viktigt* och _detta_ och __mer__',
    '# Inte en rubrik',
    '> inte ett citat',
    'Rad\n---',
    'Rad\n===',
    '***',
    '[x]: https://www.mimer.nu',
    'Se [Mina sidor](https://www.mimer.nu)',
    '<https://www.mimer.nu> och <b>fet</b>',
    'AT&T &amp; &nbsp; co',
    'a | b\n--- | ---\n1 | 2',
    'snedstreck \\ och \\* och slut\\',
    '`kod` och ```mer```',
    '~~~\ninget staket',
    '![bild](https://www.mimer.nu/x.png)',
    'Två rader\nsamma stycke\n\n\n\nNytt stycke',
    'Hej  \nhård radbrytning',
    'Åsa, Örjan & Ärla: 50% rabatt!',
  ])('keeps the SMS text of %j', (body) => {
    expect(markdownToText(escapePlainText(body))).toBe(normalise(body))
  })

  it('leaves text without markdown patterns untouched', () => {
    const body = 'Hej! Vattnet stängs av 9–12 imorgon.\n\nMvh Mimer'
    expect(escapePlainText(body)).toBe(body)
  })
})
