import DOMPurify from 'dompurify'

/**
 * Sanitizes a string of HTML for use with v-html. All <script>, event-handler
 * attributes (onerror, onclick, …), and javascript: URIs are stripped.
 *
 * Use this anywhere you would otherwise pass user-controlled or backend-stored
 * HTML directly to v-html. The TinyMCE editor lets users author rich content;
 * even though they are authenticated, treating their output as untrusted at
 * render time prevents stored XSS from one user to another.
 *
 * @param {string|null|undefined} html
 * @returns {string} sanitized HTML safe to assign to v-html
 */
export function sanitizeHtml(html) {
  if (html === null || html === undefined) return ''
  return DOMPurify.sanitize(String(html), { USE_PROFILES: { html: true } })
}
