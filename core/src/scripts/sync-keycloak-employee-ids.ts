import { logger } from '@onecore/utilities'
import {
  KeycloakUser,
  listAllUsers,
  updateUser,
} from '../services/auth-service/keycloak-admin-adapter'
import {
  GraphUser,
  listUsers as listGraphUsers,
} from '../adapters/microsoft-graph-adapter'
import { AdapterResult } from '../adapters/types'

type Deps = {
  listKeycloakUsers: () => Promise<AdapterResult<KeycloakUser[], string>>
  listGraphUsers: () => Promise<AdapterResult<GraphUser[], string>>
  updateKeycloakUser: (
    u: KeycloakUser
  ) => Promise<AdapterResult<undefined, string>>
}

export type SyncReport = {
  total: number
  updated: number
  skipped: number
  missing: number
  failed: number
}

export async function syncEmployeeIds(deps: Deps): Promise<SyncReport> {
  const kcResult = await deps.listKeycloakUsers()
  if (!kcResult.ok) throw new Error(`Keycloak list failed: ${kcResult.err}`)

  const graphResult = await deps.listGraphUsers()
  if (!graphResult.ok) throw new Error(`Graph list failed: ${graphResult.err}`)

  const graphByUpn = new Map<string, GraphUser>()
  for (const g of graphResult.data) {
    if (g.userPrincipalName) {
      graphByUpn.set(g.userPrincipalName.toLowerCase(), g)
    }
  }

  const report: SyncReport = {
    total: kcResult.data.length,
    updated: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
  }

  for (const kcUser of kcResult.data) {
    const key = (kcUser.username || kcUser.email || '').toLowerCase()
    const match = graphByUpn.get(key)
    if (!match) {
      report.missing += 1
      continue
    }
    if (!match.employeeId) {
      report.skipped += 1
      continue
    }
    const current = kcUser.attributes?.employeeId?.[0]
    if (current === match.employeeId) {
      report.skipped += 1
      continue
    }
    const merged: KeycloakUser = {
      ...kcUser,
      attributes: {
        ...(kcUser.attributes ?? {}),
        employeeId: [match.employeeId],
      },
    }
    const updateResult = await deps.updateKeycloakUser(merged)
    if (updateResult.ok) {
      report.updated += 1
    } else {
      report.failed += 1
      logger.error(
        { userId: kcUser.id, err: updateResult.err },
        'sync-keycloak-employee-ids.updateFailed'
      )
    }
  }

  return report
}

if (require.main === module) {
  syncEmployeeIds({
    listKeycloakUsers: listAllUsers,
    listGraphUsers,
    updateKeycloakUser: updateUser,
  })
    .then((report) => {
      logger.info(report, 'sync-keycloak-employee-ids complete')
      process.exit(report.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      logger.error({ err }, 'sync-keycloak-employee-ids failed')
      process.exit(1)
    })
}
