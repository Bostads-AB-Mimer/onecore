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
