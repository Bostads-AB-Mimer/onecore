/**
 * DAX Client Adapter - Uses the standalone dax-client library
 */

import {
  createDaxClient,
  type Contract,
  type CardOwner,
  type QueryCardOwnersParams,
} from 'dax-client'
import Config from '../../../common/config'
import fs from 'fs'

// Create singleton client instance
let clientInstance: ReturnType<typeof createDaxClient> | null = null

function getClient() {
  if (!clientInstance) {
    const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf8')

    clientInstance = createDaxClient({
      apiUrl: Config.alliera.apiUrl,
      clientId: Config.alliera.clientId,
      username: Config.alliera.username,
      password: Config.alliera.password,
      privateKey: privateKey,
      apiVersion: '2.0',
    })
  }

  return clientInstance
}

/**
 * Get all contracts
 */
export async function getContracts(): Promise<{ contracts: Contract[] }> {
  const client = getClient()
  return client.contracts.getAll('Testrequest')
}

/**
 * Query card owners
 */
export async function queryCardOwners(
  params: QueryCardOwnersParams
): Promise<{ cardOwners: CardOwner[] }> {
  const client = getClient()
  return client.cardOwners.query(params)
}

/**
 * Get a specific card owner by ID
 */
export async function getCardOwner(
  owningPartnerId: string,
  owningInstanceId: string,
  cardOwnerId: string
): Promise<{ cardOwner: CardOwner }> {
  const client = getClient()
  return client.cardOwners.getById(
    owningPartnerId,
    owningInstanceId,
    cardOwnerId,
    'Testrequest'
  )
}
