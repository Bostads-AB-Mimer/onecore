// Normalizes what the user types into the canonical Keycloak username before the
// form is posted: personnummer -> 12 digits, organisationsnummer -> 10 digits.
// Anything else is left untouched (and simply fails to log in).
// Loaded by Keycloak as a classic script, so it defines a global instead of exporting.
;(function (root) {
  /**
   * @param {string} yymmdd
   * @param {boolean} centenarian
   * @param {Date} now
   */
  function inferCentury(yymmdd, centenarian, now) {
    var yy = Number(yymmdd.slice(0, 2))
    var thisYear = now.getFullYear()
    var year = Math.floor(thisYear / 100) * 100 + yy
    if (year > thisYear) year -= 100
    if (centenarian) year -= 100 // '+' separator: 100 years or older
    return String(Math.floor(year / 100))
  }

  /**
   * @param {unknown} input
   * @param {Date} [now]
   * @returns {string}
   */
  function normalizeLoginId(input, now) {
    now = now || new Date()
    var raw = String(input || '').trim()
    var centenarian = raw.indexOf('+') !== -1
    var d = raw.replace(/\D/g, '')
    if (d.length === 12) return d.slice(0, 2) === '16' ? d.slice(2) : d
    if (d.length !== 10) return raw
    // Organisation numbers always have 20 or more in the "month" position
    if (Number(d.slice(2, 4)) >= 20) return d
    return inferCentury(d, centenarian, now) + d
  }

  root.normalizeLoginId = normalizeLoginId

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'submit',
      function (e) {
        var form = /** @type {HTMLFormElement | null} */ (e.target)
        var field =
          form &&
          form.querySelector &&
          /** @type {HTMLInputElement | null} */ (
            form.querySelector('input[name="username"]')
          )
        if (field) field.value = normalizeLoginId(field.value)
      },
      true
    )
  }
})(
  /** @type {{ normalizeLoginId?: (input: unknown, now?: Date) => string }} */ (
    typeof window !== 'undefined' ? window : globalThis
  )
)
