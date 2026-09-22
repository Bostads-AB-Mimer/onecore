// @vitest-environment jsdom
import { sanitizeGuideHtml } from './sanitizeHtml'

describe('sanitizeGuideHtml', () => {
  it('keeps the allowed formatting tags', () => {
    const html =
      '<p>Fyll i <strong>datum</strong> och <em>orsak</em>:</p><ul><li>Ett</li></ul>'
    expect(sanitizeGuideHtml(html)).toBe(html)
  })

  it('strips scripts, event handlers and disallowed tags', () => {
    expect(
      sanitizeGuideHtml(
        '<p onclick="x()">Hej</p><script>alert(1)</script><h1>Rubrik</h1>'
      )
    ).toBe('<p>Hej</p>Rubrik')
  })

  it('keeps links but drops javascript: urls', () => {
    expect(
      sanitizeGuideHtml('<a href="https://example.com" rel="noopener">x</a>')
    ).toBe('<a href="https://example.com" rel="noopener">x</a>')
    expect(sanitizeGuideHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a>x</a>'
    )
  })
})
