import { syncKeycloakEntraIdAttributes } from '../sync-keycloak-entra-id-attributes'
import type { KeycloakUser } from '../../services/auth-service/keycloak-admin-adapter'
import type { GraphUser } from '../../adapters/microsoft-graph-adapter'

function kcUser(over: Partial<KeycloakUser>): KeycloakUser {
  return {
    id: 'u1',
    username: 'alice@x.se',
    email: 'alice@x.se',
    attributes: {},
    ...over,
  }
}

function graphUser(over: Partial<GraphUser>): GraphUser {
  return {
    id: 'g1',
    userPrincipalName: 'alice@x.se',
    employeeId: 'E1',
    mobilePhone: null,
    jobTitle: null,
    officeLocation: null,
    ...over,
    managerUpn: over.managerUpn ?? null,
  }
}

describe('syncKeycloakEntraIdAttributes', () => {
  it('updates a user whose employeeId is missing in Keycloak', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'alice@x.se' })],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: 'E1' }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result).toMatchObject({ updated: 1, skipped: 0, missing: 0 })
    expect(updates).toHaveLength(1)
    expect(updates[0].attributes?.employeeId).toEqual(['E1'])
  })

  it('skips users whose employeeId already matches', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({
            id: 'u1',
            username: 'alice@x.se',
            attributes: { employeeId: ['E1'] },
          }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: 'E1' }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result).toMatchObject({ updated: 0, skipped: 1, missing: 0 })
    expect(updates).toHaveLength(0)
  })

  it('skips users whose Graph employeeId is null (does NOT clear existing value)', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({
            id: 'u1',
            username: 'alice@x.se',
            attributes: { employeeId: ['E1'] },
          }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: null }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result).toMatchObject({ updated: 0, skipped: 1, missing: 0 })
    expect(updates).toHaveLength(0)
  })

  it('counts Keycloak users with no Graph match as missing', async () => {
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'ghost@x.se' })],
      }),
      listGraphUsers: async () => ({ ok: true, data: [] }),
      updateKeycloakUser: async () => ({ ok: true, data: undefined }),
    })
    expect(result).toMatchObject({ updated: 0, skipped: 0, missing: 1 })
  })

  it('matches case-insensitively on UPN', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'Alice@X.SE' })],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: 'E1' }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result.updated).toBe(1)
  })

  it('does not call updateKeycloakUser in dry-run mode but still counts updates', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'alice@x.se' })],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: 'E1' }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
      dryRun: true,
    })
    expect(updates).toHaveLength(0)
    expect(result).toMatchObject({ updated: 1, dryRun: true })
  })

  it('preserves other attributes during update', async () => {
    const updates: KeycloakUser[] = []
    await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({
            id: 'u1',
            username: 'alice@x.se',
            attributes: { jobTitle: ['Dev'], mobilePhone: ['+46123'] },
          }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({ userPrincipalName: 'alice@x.se', employeeId: 'E1' }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(updates[0].attributes).toEqual({
      jobTitle: ['Dev'],
      mobilePhone: ['+46123'],
      employeeId: ['E1'],
    })
  })

  it('sets managerUpn and resolves managerId from the Keycloak user list', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({ id: 'u1', username: 'alice@x.se' }),
          kcUser({ id: 'boss-kc-id', username: 'bob@x.se', email: 'bob@x.se' }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({
            userPrincipalName: 'alice@x.se',
            employeeId: null,
            managerUpn: 'bob@x.se',
          }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result).toMatchObject({ updated: 1 })
    const alice = updates.find((u) => u.id === 'u1')
    expect(alice?.attributes?.managerUpn).toEqual(['bob@x.se'])
    expect(alice?.attributes?.managerId).toEqual(['boss-kc-id'])
  })

  it('resolves managerId case-insensitively on the manager UPN', async () => {
    const updates: KeycloakUser[] = []
    await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({ id: 'u1', username: 'alice@x.se' }),
          kcUser({ id: 'boss-kc-id', username: 'Bob@X.se', email: 'Bob@X.se' }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({
            userPrincipalName: 'alice@x.se',
            employeeId: null,
            managerUpn: 'BOB@x.SE',
          }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    const alice = updates.find((u) => u.id === 'u1')
    expect(alice?.attributes?.managerId).toEqual(['boss-kc-id'])
    expect(alice?.attributes?.managerUpn).toEqual(['BOB@x.SE'])
  })

  it('sets managerUpn but leaves managerId unset when the manager is not in Keycloak', async () => {
    const updates: KeycloakUser[] = []
    await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'alice@x.se' })],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({
            userPrincipalName: 'alice@x.se',
            employeeId: null,
            managerUpn: 'ghostboss@x.se',
          }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(updates[0].attributes?.managerUpn).toEqual(['ghostboss@x.se'])
    expect(updates[0].attributes?.managerId).toBeUndefined()
  })

  it('sets no manager attributes when Graph has no manager', async () => {
    const updates: KeycloakUser[] = []
    await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [kcUser({ id: 'u1', username: 'alice@x.se' })],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({
            userPrincipalName: 'alice@x.se',
            employeeId: 'E1',
            managerUpn: null,
          }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(updates[0].attributes?.managerUpn).toBeUndefined()
    expect(updates[0].attributes?.managerId).toBeUndefined()
  })

  it('skips a user whose manager attributes already match', async () => {
    const updates: KeycloakUser[] = []
    const result = await syncKeycloakEntraIdAttributes({
      listKeycloakUsers: async () => ({
        ok: true,
        data: [
          kcUser({
            id: 'u1',
            username: 'alice@x.se',
            attributes: {
              managerUpn: ['bob@x.se'],
              managerId: ['boss-kc-id'],
            },
          }),
          kcUser({ id: 'boss-kc-id', username: 'bob@x.se', email: 'bob@x.se' }),
        ],
      }),
      listGraphUsers: async () => ({
        ok: true,
        data: [
          graphUser({
            userPrincipalName: 'alice@x.se',
            employeeId: null,
            managerUpn: 'bob@x.se',
          }),
        ],
      }),
      updateKeycloakUser: async (u) => {
        updates.push(u)
        return { ok: true, data: undefined }
      },
    })
    expect(result).toMatchObject({ updated: 0, skipped: 1 })
    expect(updates).toHaveLength(0)
  })
})
