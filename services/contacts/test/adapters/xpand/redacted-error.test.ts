import { redactedError } from '@src/adapters/xpand/redacted-error'

describe('redactedError', () => {
  const PERSONNUMMER = '199007292387'

  const queryError = () => {
    // How knex reports a failed query: the compiled SQL, bindings included.
    const err = new Error(
      `select * from cmctc where persorgnr = '${PERSONNUMMER}'\n - Timeout: Request failed to complete`
    )
    return Object.assign(err, { code: 'ETIMEOUT' })
  }

  it('keeps the name, the code and the stack frames', () => {
    const { err } = redactedError(queryError())

    expect(err.name).toBe('Error')
    expect(err.code).toBe('ETIMEOUT')
    expect(err.stack).toMatch(/^\s+at /)
  })

  it('leaves out the message, also where the stack repeats it', () => {
    expect(JSON.stringify(redactedError(queryError()))).not.toContain(
      PERSONNUMMER
    )
  })

  it('handles an error without a code', () => {
    expect(redactedError(new TypeError('x')).err).toMatchObject({
      name: 'TypeError',
      code: undefined,
    })
  })

  it('handles something thrown that is not an Error', () => {
    expect(redactedError(PERSONNUMMER)).toEqual({ err: { name: 'string' } })
  })
})
