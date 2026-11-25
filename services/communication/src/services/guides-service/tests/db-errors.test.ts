import { isUniqueViolation, isUniqueViolationOn } from '../adapters/db-errors'

describe('isUniqueViolation', () => {
  it.each([
    ['a unique index violation (2601)', { number: 2601 }],
    ['a unique constraint violation (2627)', { number: 2627 }],
    ['a knex-wrapped tedious error', { originalError: { number: 2627 } }],
    [
      'a knex-wrapped unique index violation',
      Object.assign(new Error('Violation of UNIQUE KEY constraint'), {
        originalError: { number: 2601 },
      }),
    ],
  ])('is true for %s', (_name, err) => {
    expect(isUniqueViolation(err)).toBe(true)
  })

  it.each([
    ['a foreign key violation (547)', { number: 547 }],
    ['a wrapped foreign key violation', { originalError: { number: 547 } }],
    ['a plain error', new Error('connection lost')],
    ['a non-numeric number property', { number: '2627' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Violation of UNIQUE KEY constraint'],
  ])('is false for %s', (_name, err) => {
    expect(isUniqueViolation(err)).toBe(false)
  })
})

describe('isUniqueViolationOn', () => {
  const SLUG_INDEXES = ['uq_guide_slug']

  const duplicateKey = (indexName: string) =>
    Object.assign(
      new Error(
        `Cannot insert duplicate key row in object 'dbo.guide' with unique index '${indexName}'.`
      ),
      { number: 2601 }
    )

  const uniqueConstraint = (indexName: string) =>
    Object.assign(
      new Error(`Violation of UNIQUE KEY constraint '${indexName}'.`),
      { originalError: { number: 2627 } }
    )

  it.each([
    ['a 2601 duplicate key on the slug index', duplicateKey('uq_guide_slug')],
    [
      'a 2627 constraint violation on the slug index',
      uniqueConstraint('uq_guide_slug'),
    ],
    [
      'a wrapped error that only names the index on the inner error',
      Object.assign(new Error('insert failed'), {
        originalError: {
          number: 2601,
          message:
            "Cannot insert duplicate key row in object 'dbo.guide' with unique index 'uq_guide_slug'.",
        },
      }),
    ],
  ])('is true for %s', (_name, err) => {
    expect(isUniqueViolationOn(err, SLUG_INDEXES)).toBe(true)
  })

  it.each([
    // A unique violation on an unrelated index must not be mapped to a slug
    // conflict; the caller rethrows it unchanged.
    ['a unique violation on another index', duplicateKey('uq_guide_category')],
    [
      'a unique violation on an index whose name starts with the slug index',
      duplicateKey('uq_guide_slug_other'),
    ],
    [
      'a unique violation whose message names no index',
      Object.assign(new Error('Violation of UNIQUE KEY constraint'), {
        number: 2627,
      }),
    ],
    ['a foreign key violation', { number: 547 }],
    ['a plain error', new Error('connection lost')],
    ['null', null],
  ])('is false for %s', (_name, err) => {
    expect(isUniqueViolationOn(err, SLUG_INDEXES)).toBe(false)
  })
})
