import { TrustedHtml } from '../render/trusted-html'
import { EMAIL_STYLES } from '../render/styles'

// sanitize-html writes style attributes without the trailing semicolon.
const inline = (style: string) => style.replace(/;$/, '')
const block = (html: string) =>
  `<div style="${EMAIL_STYLES.paragraph}">${html}</div>`

describe('TrustedHtml.fromUntrusted', () => {
  const clean = (html: string) => TrustedHtml.fromUntrusted(html).html

  it('keeps the formatting an editor produces, with our inline styles', () => {
    const html = clean(
      '<p>Hej <strong>Åsa</strong>!<br>Vi <em>kommer</em>.</p><ul><li>Ett</li></ul>'
    )
    expect(html).toContain(
      `<p style="${inline(EMAIL_STYLES.paragraph)}">Hej <strong>Åsa</strong>!<br />Vi <em>kommer</em>.</p>`
    )
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
  })

  it('keeps https, mailto and tel links, styled', () => {
    const html = clean(
      '<a href="https://mimer.nu">a</a><a href="mailto:a@b.se">b</a><a href="tel:+4621">c</a>'
    )
    expect(html).toContain(
      `<a href="https://mimer.nu" style="${inline(EMAIL_STYLES.link)}">a</a>`
    )
    expect(html).toContain('href="mailto:a@b.se"')
    expect(html).toContain('href="tel:+4621"')
  })

  it('writes any other link as its text and address, not as a link', () => {
    const message = TrustedHtml.fromUntrusted(
      '<p><a href="http://x.se/?a=1&amp;b=2">sidan</a> och <a href="/rel">r</a> och <a href="javascript:alert(1)">j</a></p>'
    )
    expect(message.html).toContain(
      'sidan (http://x.se/?a=1&amp;b=2) och r (/rel)'
    )
    expect(message.html).not.toMatch(/<a\b/)
    expect(message.text).toBe(
      'sidan (http://x.se/?a=1&b=2) och r (/rel) och j (javascript:alert(1))'
    )
  })

  it('removes scripts, event handlers, images and styles', () => {
    const html = clean(
      '<script>alert(1)</script><style>p{}</style>' +
        '<p onclick="x()" class="c" style="width:900px">Text</p>' +
        '<img src="https://track.example/p.gif">' +
        '<iframe src="https://x"></iframe>'
    )
    expect(html).not.toMatch(
      /script|onclick|class=|width:900px|<img|<iframe|<style/
    )
    expect(html).toContain('Text')
  })

  it('closes tags left open, so the layout around it stays intact', () => {
    expect(clean('<p><strong>Öppen')).toBe(
      block(
        `<p style="${inline(EMAIL_STYLES.paragraph)}"><strong>Öppen</strong></p>`
      )
    )
  })

  it('treats text without tags as plain text, keeping its line breaks', () => {
    expect(clean('Hej!\nVi <3 er & kommer.')).toBe(
      block('Hej!<br />Vi &lt;3 er &amp; kommer.')
    )
  })

  it('wraps inline-only HTML in a styled block', () => {
    expect(clean('Hej<br>du')).toBe(block('Hej<br />du'))
  })

  it('keeps text after the first block inside the styled block', () => {
    expect(clean('<p>a</p>efter')).toBe(
      block(`<p style="${inline(EMAIL_STYLES.paragraph)}">a</p>efter`)
    )
  })

  it('keeps div lines apart, as lines without a gap between them', () => {
    const line = `<div style="${inline(EMAIL_STYLES.line)}">`
    expect(clean('<div>Rad A</div><div>Rad <b>B</b></div>')).toBe(
      block(`${line}Rad A</div>${line}Rad <b>B</b></div>`)
    )
  })

  it('handles long whitespace runs and unclosed tags in linear time', () => {
    const hostile =
      ' '.repeat(200_000) +
      '<a'.repeat(50_000) +
      '<a href="x">'.repeat(20_000) +
      '<li'.repeat(50_000)
    const started = Date.now()
    TrustedHtml.fromUntrusted(hostile)
    TrustedHtml.fromUntrusted(`<p>${hostile}</p>`)
    // Quadratic regexes take tens of seconds on this input.
    expect(Date.now() - started).toBeLessThan(2000)
  })
})

describe('TrustedHtml text', () => {
  const text = (html: string) => TrustedHtml.fromUntrusted(html).text

  it('keeps paragraphs apart and line breaks, decodes entities', () => {
    expect(
      text(
        '<p>Hej!</p><p>Vi kommer &amp; byter<br/>packningen.</p><script>x</script>'
      )
    ).toBe('Hej!\n\nVi kommer & byter\npackningen.')
  })

  it('writes div lines as lines', () => {
    expect(text('<div>Rad A</div><div>Rad B</div>')).toBe('Rad A\nRad B')
  })

  it('writes a link as its text followed by the address', () => {
    expect(
      text(
        `<p>Se <a href="https://a.se/?x=1&amp;y=2">här</a> och <a href='https://b.se'><b>där</b></a></p>`
      )
    ).toBe('Se här (https://a.se/?x=1&y=2) och där (https://b.se)')
  })

  it('writes a link whose text is its address only once', () => {
    expect(
      text(
        '<a href="https://a.se">https://a.se</a> <a href="mailto:a@b.se">a@b.se</a> <a href="tel:+4621">+4621</a>'
      )
    ).toBe('https://a.se a@b.se +4621')
  })

  it('writes list items as lines', () => {
    expect(text('<ul><li>Ett</li><li>Två</li></ul>')).toBe('- Ett\n- Två')
  })

  it('treats raw newlines in HTML as spaces, like a mail client does', () => {
    expect(text('<p>Hej\nAnna,<br>vi kommer\n</p>')).toBe(
      'Hej Anna,\nvi kommer'
    )
  })

  it('keeps the lines of plain text', () => {
    expect(text('Hej!\nVi kommer.')).toBe('Hej!\nVi kommer.')
  })
})
