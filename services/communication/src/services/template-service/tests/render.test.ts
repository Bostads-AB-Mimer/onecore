import {
  fillPlaceholders,
  inspectMarkdown,
  InvalidPlaceholderUrlError,
  markdownToText,
  MissingPlaceholderError,
  renderMarkdown,
} from '../render/render'
import { EMAIL_STYLES } from '../render/styles'
import { TrustedHtml } from '../render/trusted-html'

describe('fillPlaceholders', () => {
  it('fills tokens, tolerating inner whitespace', () => {
    expect(
      fillPlaceholders('Hej {{firstName}}, {{ address }}', {
        firstName: 'Åsa',
        address: 'Gatan 1',
      })
    ).toBe('Hej Åsa, Gatan 1')
  })

  it('throws listing every missing token', () => {
    let thrown: unknown
    try {
      fillPlaceholders('{{a}} {{b}} {{c}}', { a: '1' })
    } catch (err: unknown) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(MissingPlaceholderError)
    expect(thrown).toMatchObject({
      code: 'MISSING_PLACEHOLDER',
      tokens: ['b', 'c'],
    })
  })

  it('treats an empty string as a value', () => {
    expect(fillPlaceholders('[{{x}}]', { x: '' })).toBe('[]')
  })

  it('ignores placeholders the text does not use', () => {
    expect(fillPlaceholders('{{a}}', { a: '1', b: '2' })).toBe('1')
  })
})

describe('renderMarkdown', () => {
  it('never parses a value as markdown or markup', () => {
    const { html, text } = renderMarkdown('Hej {{n}}', {
      n: '*Åsa* [x](y) <b>',
    })
    expect(html).toContain('*Åsa* [x](y) &lt;b&gt;')
    expect(html).not.toContain('<em')
    expect(html).not.toContain('<a')
    expect(text).toContain('*Åsa* [x](y) <b>')
  })

  it('fills a placeholder used as a link address', () => {
    const { html, text } = renderMarkdown('[Svara]({{u}})', {
      u: 'https://a.se/?a=1&b=2',
    })
    expect(html).toContain('href="https://a.se/?a=1&amp;b=2"')
    expect(text).toContain('Svara (https://a.se/?a=1&b=2)')
  })

  it('rejects a link value with a disallowed protocol', () => {
    let thrown: unknown
    try {
      renderMarkdown('[Svara]({{u}})', { u: 'javascript:alert(1)' })
    } catch (err: unknown) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(InvalidPlaceholderUrlError)
    expect(thrown).toMatchObject({
      code: 'INVALID_PLACEHOLDER_URL',
      token: 'u',
    })
  })

  it('rejects a non-https image value', () => {
    expect(() =>
      renderMarkdown('![Bild]({{img}})', { img: 'mailto:a@b.se' })
    ).toThrow(InvalidPlaceholderUrlError)
  })

  it('renders an image with a fixed width and leaves it out of the text', () => {
    const { html, text } = renderMarkdown('![Bilplats]({{img}})', {
      img: 'https://pub.mimer.nu/x.jpg',
    })
    expect(html).toMatch(/<img [^>]*src="https:\/\/pub\.mimer\.nu\/x\.jpg"/)
    expect(html).toMatch(/<img [^>]*alt="Bilplats"/)
    // Content cell is 500px minus 2×10px padding; wider widens Outlook's layout.
    expect(html).toMatch(/<img [^>]*width="480"/)
    expect(text).not.toContain('pub.mimer.nu')
    expect(text).not.toContain('Bilplats')
  })

  it('escapes values in the image tag', () => {
    const { html } = renderMarkdown('![{{alt}}]({{img}})', {
      alt: '"><b>',
      img: 'https://a.se/x".jpg',
    })
    expect(html).toContain('alt="&quot;&gt;&lt;b&gt;"')
    expect(html).toContain('src="https://a.se/x&quot;.jpg"')
    expect(html).not.toContain('<b>')
  })

  it('drops a block that is empty once filled', () => {
    const { html, text } = renderMarkdown('Hej\n\n{{x}}\n\nSlut', { x: '' })
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/)
    expect(text).toBe('Hej\n\nSlut')
  })

  it('compares filled, trimmed link text with the address in the text', () => {
    const { text } = renderMarkdown('[{{u}}]({{u}}) och [{{d}} ]({{u}})', {
      u: 'https://a.se',
      d: '30 nov',
    })
    expect(text).toBe('https://a.se och 30 nov (https://a.se)')
  })

  it('does not count inherited object keys as values', () => {
    expect(() => fillPlaceholders('{{toString}}', {})).toThrow(
      MissingPlaceholderError
    )
  })

  it('does not let a value pull in another value through slot characters', () => {
    const { html } = renderMarkdown('[a]({{u}}) {{v}}', {
      u: 'https://a.se/1',
      v: 'SECRET',
    })
    expect(html).not.toContain('href="https://a.se/SECRET"')
  })

  it('inserts a TrustedHtml value as HTML, without a wrapping paragraph', () => {
    const message = TrustedHtml.fromUntrusted('<p>Hej!</p><p>Vi kommer.</p>')
    const { html, text } = renderMarkdown('{{m}}\n\nMed vänlig hälsning', {
      m: message,
    })
    expect(html).toContain(message.html)
    expect(html).not.toMatch(/<p[^>]*>\s*<p/)
    expect(text).toBe('Hej!\n\nVi kommer.\n\nMed vänlig hälsning')
  })

  it('escapes a TrustedHtml value that shares a paragraph with other text', () => {
    const { html } = renderMarkdown('Meddelande: {{m}}', {
      m: TrustedHtml.fromUntrusted('<p>Hej</p>'),
    })
    expect(html).not.toMatch(/<p[^>]*>Meddelande: <p/)
    expect(html).toContain('Meddelande: Hej')
  })

  it('rejects a TrustedHtml value used as a link address', () => {
    expect(() =>
      renderMarkdown('[a]({{u}})', {
        u: TrustedHtml.fromUntrusted('https://a.se'),
      })
    ).toThrow(InvalidPlaceholderUrlError)
  })

  it('styles a link titled "button" as a button and drops the title', () => {
    const { html } = renderMarkdown('[Svara]({{u}} "button")', {
      u: 'https://a.se',
    })
    expect(html).toContain(`style="${EMAIL_STYLES.button}"`)
    expect(html).not.toContain('title=')
  })

  it('renders a two-column table as a fact list', () => {
    const { html, text } = renderMarkdown('| | |\n|-|-|\n| Hyra | {{rent}} |', {
      rent: '450 kr',
    })
    expect(html).toMatch(/<table style="/)
    expect(html).toMatch(/<td[^>]*>450 kr<\/td>/)
    expect(text).toContain('Hyra: 450 kr')
  })

  it('drops the empty header row of every fact table', () => {
    const table = '| | |\n|-|-|\n| A | 1 |'
    const { html, text } = renderMarkdown(`${table}\n\nMitt\n\n${table}`, {})
    expect(html).not.toContain('<th')
    expect(text).toBe('A: 1\n\nMitt\n\nA: 1')
  })

  it('keeps line breaks inside a multi-line value', () => {
    const { html, text } = renderMarkdown('{{m}}', { m: 'rad 1\nrad 2' })
    expect(html).toContain('rad 1<br>rad 2')
    expect(text).toContain('rad 1\nrad 2')
  })

  it('does not pass raw HTML through', () => {
    const { html } = renderMarkdown('<script>x</script>', {})
    expect(html).not.toContain('<script')
  })

  it('applies inline styles to paragraphs', () => {
    expect(renderMarkdown('Hej', {}).html).toMatch(/^<p style="/)
  })

  it('throws on a missing token', () => {
    expect(() => renderMarkdown('Hej {{n}}', {})).toThrow(
      MissingPlaceholderError
    )
  })

  it('separates blocks with a blank line in the text', () => {
    expect(renderMarkdown('Hej\n\n**Då**', {}).text).toBe('Hej\n\nDå')
  })

  it('keeps list markers in the text, one line per item', () => {
    const { text } = renderMarkdown(
      'Ta med:\n\n- legitimation\n- nyckel\n  1. kvitto\n  2. kort\n\n3. tre\n4. fyra\n\nSlut',
      {}
    )
    expect(text).toBe(
      'Ta med:\n\n- legitimation\n- nyckel\n  1. kvitto\n  2. kort\n\n3. tre\n4. fyra\n\nSlut'
    )
  })

  it('styles ## as a heading and ### as a subheading', () => {
    const { html, text } = renderMarkdown(
      '## Rubrik\n\n### Underrubrik\nText',
      {}
    )
    expect(html).toContain(`<h2 style="${EMAIL_STYLES.heading}">Rubrik</h2>`)
    expect(html).toContain(
      `<h3 style="${EMAIL_STYLES.subheading}">Underrubrik</h3>`
    )
    expect(text).toBe('Rubrik\n\nUnderrubrik\n\nText')
  })

  it('styles lists in the html', () => {
    const { html } = renderMarkdown('- a\n- b', {})
    expect(html).toContain(`<ul style="${EMAIL_STYLES.list}">`)
    expect(html).toContain(`<li style="${EMAIL_STYLES.listItem}">a</li>`)
  })

  it('keeps an indented code block as text', () => {
    expect(renderMarkdown('Hej\n\n    indraget', {}).text).toBe(
      'Hej\n\nindraget'
    )
  })
})

describe('inspectMarkdown', () => {
  it('lists link and image addresses with tokens as written', () => {
    const { urls } = inspectMarkdown(
      '[a](https://a.se) [b]({{offerURL}} "button") ![c]({{img}})'
    )
    expect(urls).toEqual([
      { kind: 'link', href: 'https://a.se' },
      { kind: 'link', href: '{{offerURL}}' },
      { kind: 'image', href: '{{img}}' },
    ])
  })

  it('counts a token only where it is alone in its paragraph', () => {
    const { aloneCounts } = inspectMarkdown(
      '{{message}}\n\nText {{message}}\n\n| | |\n|-|-|\n| {{message}} | x |'
    )
    expect(aloneCounts.get('message')).toBe(1)
  })
})

describe('markdownToText', () => {
  it('strips the markdown and leaves tokens as written', () => {
    expect(markdownToText('**Hej {{firstName}}!** [Läs](https://a.se)')).toBe(
      'Hej {{firstName}}! Läs (https://a.se)'
    )
  })

  it('keeps a placeholder used as an address, since only the send fills it', () => {
    expect(
      markdownToText('[Svara]({{offerURL}} "button")\n\n![Bild]({{img}})')
    ).toBe('Svara ({{offerURL}})')
  })
})
