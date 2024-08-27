jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

import { isMessageEmail } from '../index'

describe('isMessageEmail', () => {
  it('should return true for valid email objects', () => {
    const validEmail = {
      to: 'test@example.com',
      subject: 'subject',
      text: 'text',
    }

    expect(isMessageEmail(validEmail)).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    const invalidEmailAddress = {
      to: 'invalid email',
      subject: 'subject',
      text: 'text',
    }

    expect(isMessageEmail(invalidEmailAddress)).toBe(false)
  })

  it('should return false for objects missing required properties', () => {
    const missingProperties = {
      to: 'test@example.com',
      subject: 'subject',
    }

    expect(isMessageEmail(missingProperties)).toBe(false)
  })

  it('should return false for objects with incorrect property types', () => {
    const incorrectTypes = {
      to: 'test@example.com',
      subject: 123,
      text: 'text',
    }

    expect(isMessageEmail(incorrectTypes)).toBe(false)
  })

  it('should return false for non-object inputs', () => {
    expect(isMessageEmail('not an object')).toBe(false)
  })
})
