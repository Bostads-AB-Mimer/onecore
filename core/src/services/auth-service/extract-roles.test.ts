import { extractRolesFromToken } from './extract-roles'

describe('extractRolesFromToken', () => {
  it('should extract realm roles', () => {
    const claims = {
      realm_access: {
        roles: ['admin', 'user'],
      },
    }
    expect(extractRolesFromToken(claims)).toEqual(['admin', 'user'])
  })

  it('should extract client-specific roles', () => {
    const claims = {
      resource_access: {
        'onecore-test': {
          roles: ['planner', 'viewer'],
        },
      },
    }
    expect(extractRolesFromToken(claims, 'onecore-test')).toEqual([
      'planner',
      'viewer',
    ])
  })

  it('should not extract client-specific roles without clientId', () => {
    const claims = {
      resource_access: {
        'onecore-test': {
          roles: ['planner', 'viewer'],
        },
      },
    }
    expect(extractRolesFromToken(claims)).toEqual([])
  })

  it('should extract Azure AD groups', () => {
    const claims = {
      groups: ['IT-Department', 'Administrators'],
    }
    expect(extractRolesFromToken(claims)).toEqual([
      'Administrators',
      'IT-Department',
    ])
  })

  it('should aggregate from all sources and deduplicate', () => {
    const claims = {
      realm_access: {
        roles: ['user', 'admin'],
      },
      resource_access: {
        'onecore-test': {
          roles: ['planner', 'user'], // 'user' is duplicate
        },
      },
      groups: ['IT-Department'],
    }
    const roles = extractRolesFromToken(claims, 'onecore-test')
    expect(roles).toEqual(['IT-Department', 'admin', 'planner', 'user'])
  })

  it('should handle missing claims gracefully', () => {
    expect(extractRolesFromToken({})).toEqual([])
  })

  it('should handle undefined values', () => {
    const claims = {
      realm_access: undefined,
      resource_access: undefined,
      groups: undefined,
    }
    expect(extractRolesFromToken(claims)).toEqual([])
  })

  it('should handle partial realm_access object', () => {
    const claims = {
      realm_access: {},
    }
    expect(extractRolesFromToken(claims)).toEqual([])
  })

  it('should handle partial resource_access object', () => {
    const claims = {
      resource_access: {
        'onecore-test': {},
      },
    }
    expect(extractRolesFromToken(claims, 'onecore-test')).toEqual([])
  })

  it('should return sorted array', () => {
    const claims = {
      realm_access: {
        roles: ['zebra', 'apple', 'middle'],
      },
    }
    expect(extractRolesFromToken(claims)).toEqual(['apple', 'middle', 'zebra'])
  })
})
