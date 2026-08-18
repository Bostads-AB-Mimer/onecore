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
  dryRun?: boolean
}

export type SyncReport = {
  total: number
  updated: number
  skipped: number
  missing: number
  failed: number
  dryRun: boolean
}

export async function syncKeycloakEntraIdAttributes(
  deps: Deps
): Promise<SyncReport> {
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
    dryRun: deps.dryRun ?? false,
  }

  // Attributes synced from Microsoft Graph to Keycloak. The Graph property name
  // is reused as the Keycloak attribute key. Null Graph values are skipped — we
  // never clear an existing Keycloak value from a sync run.
  const SYNCED_ATTRIBUTES = [
    'employeeId',
    'mobilePhone',
    'jobTitle',
    'officeLocation',
  ] as const

  for (const kcUser of kcResult.data) {
    const key = (kcUser.username || kcUser.email || '').toLowerCase()
    const match = graphByUpn.get(key)
    if (!match) {
      report.missing += 1
      continue
    }
    const mergedAttributes: Record<string, string[]> = {
      ...(kcUser.attributes ?? {}),
    }
    let hasChanges = false
    for (const attr of SYNCED_ATTRIBUTES) {
      const graphValue = match[attr]
      if (!graphValue) continue
      const current = kcUser.attributes?.[attr]?.[0]
      if (current === graphValue) continue
      mergedAttributes[attr] = [graphValue]
      hasChanges = true
    }
    if (!hasChanges) {
      report.skipped += 1
      continue
    }
    const merged: KeycloakUser = {
      ...kcUser,
      attributes: mergedAttributes,
    }
    if (deps.dryRun) {
      const changedAttrs = SYNCED_ATTRIBUTES.filter(
        (attr) => mergedAttributes[attr]?.[0] !== kcUser.attributes?.[attr]?.[0]
      )
      logger.info(
        { username: merged.username, changedAttrs },
        'sync-keycloak-entra-id-attributes.wouldUpdate'
      )
      report.updated += 1
      continue
    }
    const updateResult = await deps.updateKeycloakUser(merged)
    if (updateResult.ok) {
      logger.info(`updated ${merged.username}`)
      report.updated += 1
    } else {
      logger.warn(`failed to update ${merged.username}`)
      report.failed += 1
      logger.error(
        { userId: kcUser.id, err: updateResult.err },
        'sync-keycloak-entra-id-attributes.updateFailed'
      )
    }
  }

  return report
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) {
    logger.info('sync-keycloak-entra-id-attributes running in --dry-run mode')
  }
  syncKeycloakEntraIdAttributes({
    listKeycloakUsers: listAllUsers,
    listGraphUsers,
    updateKeycloakUser: updateUser,
    dryRun,
  }).then((report) => {
    logger.info(report, 'sync-keycloak-entra-id-attributes complete')
    if (report.failed > 0) {
      throw new Error(`Sync completed with ${report.failed} failed updates`)
    }
  })
}
