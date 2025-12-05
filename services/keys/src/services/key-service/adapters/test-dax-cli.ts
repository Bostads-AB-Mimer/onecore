/**
 * Quick test script for the DAX CLI wrapper
 * Run with: npx tsx src/services/key-service/adapters/test-dax-cli.ts
 */

import { getContractsCli, getCardOwnersCli } from './dax-cli-wrapper'
import Config from '../../../common/config'

async function test() {
  console.log('Testing DAX CLI wrapper...')
  console.log('==========================================')

  try {
    console.log('\n1. Testing getContracts...')
    const contracts = await getContractsCli() as any
    console.log('✓ Contracts fetched successfully')
    console.log(`  Found ${contracts.Contracts?.length || 0} contracts`)

    console.log('\n2. Testing getCardOwners...')
    const partnerId = Config.alliera.partnerId
    const instanceId = Config.alliera.owningInstanceId

    console.log(`  Partner ID: ${partnerId}`)
    console.log(`  Instance ID: ${instanceId}`)

    const cardOwners = await getCardOwnersCli(partnerId, instanceId) as any
    console.log('✓ Card owners fetched successfully')
    console.log('Result:', JSON.stringify(cardOwners, null, 2))
  } catch (error) {
    console.error('\n✗ Error:', error)
    process.exit(1)
  }
}

test()
