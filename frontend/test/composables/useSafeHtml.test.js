import { sanitizeHtml } from '@/composables/useSafeHtml.js'

describe('sanitizeHtml', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })

  it('preserves harmless HTML tags', () => {
    const html = '<p>hello <strong>world</strong></p>'
    expect(sanitizeHtml(html)).toBe('<p>hello <strong>world</strong></p>')
  })

  it('strips <script> tags entirely', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/alert\(1\)/)
    expect(out).toContain('<p>ok</p>')
  })

  it('removes inline event-handler attributes', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">')
    expect(out).not.toMatch(/onerror/i)
    expect(out).not.toMatch(/alert\(1\)/)
  })

  it('strips javascript: URIs from href', () => {
    // eslint-disable-next-line no-script-url
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toMatch(/javascript:/i)
  })

  it('removes <iframe> elements (clickjacking vector)', () => {
    const out = sanitizeHtml('<iframe src="https://evil.example"></iframe>')
    expect(out).not.toMatch(/<iframe/i)
  })

  it('handles empty string without crashing', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('coerces non-string input to string before sanitizing', () => {
    expect(sanitizeHtml(123)).toBe('123')
  })
})
