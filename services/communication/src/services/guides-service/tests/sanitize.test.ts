import { sanitizeGuideHtml, sanitizeGuideWrite } from '../sanitize'
import * as factory from './factories'

describe('sanitizeGuideHtml', () => {
  it('keeps the allowed formatting tags', () => {
    const html =
      '<p>Fill in <strong>Uppsägningsdatum</strong> and <em>Orsak</em>:</p><ul><li>One</li><li>Two</li></ul><br />'
    expect(sanitizeGuideHtml(html)).toBe(
      '<p>Fill in <strong>Uppsägningsdatum</strong> and <em>Orsak</em>:</p><ul><li>One</li><li>Two</li></ul><br />'
    )
  })

  it('strips scripts, event handlers and inline styles', () => {
    const html =
      '<p style="color:red" onclick="steal()">Hi</p><script>alert(1)</script><img src="x" onerror="steal()">'
    expect(sanitizeGuideHtml(html)).toBe('<p>Hi</p>')
  })

  it('keeps http links and forces rel=noopener', () => {
    const html = '<a href="https://example.com" target="_blank">Link</a>'
    expect(sanitizeGuideHtml(html)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>'
    )
  })

  it('drops javascript: links but keeps the text', () => {
    const html = '<a href="javascript:alert(1)">Click</a>'
    expect(sanitizeGuideHtml(html)).toBe(
      '<a rel="noopener noreferrer">Click</a>'
    )
  })

  // One case per known bypass, so a future allowlist change cannot quietly
  // let one of them back in.
  it.each([
    [
      'data: urls',
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">D</a>',
    ],
    ['mixed-case javascript:', '<a href="JaVaScRiPt:alert(1)">D</a>'],
    ['an entity-encoded colon', '<a href="javascript&#58;alert(1)">D</a>'],
    [
      'an entity-encoded first letter',
      '<a href="&#106;avascript:alert(1)">D</a>',
    ],
    ['protocol-relative urls', '<a href="//evil.example.com">D</a>'],
    ['backslash-relative urls', '<a href="\\\\evil.example.com">D</a>'],
  ])('drops the href of %s', (_name, html) => {
    expect(sanitizeGuideHtml(html)).toBe('<a rel="noopener noreferrer">D</a>')
  })

  it.each([
    ['svg with an event handler', '<svg onload="alert(1)"><p>after</p></svg>'],
    [
      'iframe srcdoc',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe><p>after</p>',
    ],
  ])('strips %s', (_name, html) => {
    expect(sanitizeGuideHtml(html)).toBe('<p>after</p>')
  })

  it('keeps relative links to other ONECore pages', () => {
    const html = '<a href="/hyresgaster/P123">Kund</a>'
    expect(sanitizeGuideHtml(html)).toBe(
      '<a href="/hyresgaster/P123" rel="noopener noreferrer">Kund</a>'
    )
  })
})

describe('sanitizeGuideWrite', () => {
  it('sanitizes every step body and leaves the rest untouched', () => {
    const input = factory.guideWrite.build({
      steps: [
        factory.step.build({ body: '<p>ok</p><script>x()</script>' }),
        factory.step.build({ body: '<h1>no headings</h1>' }),
      ],
    })

    const result = sanitizeGuideWrite(input)

    expect(result.steps[0].body).toBe('<p>ok</p>')
    expect(result.steps[1].body).toBe('no headings')
    expect(result.title).toBe(input.title)
    expect(result.steps[0].id).toBe(input.steps[0].id)
  })
})
