/**
 * Quick test script for the DAX CLI wrapper
 * Run with: npx tsx src/services/key-service/adapters/test-dax-cli.ts
 */

import { getContractsCli } from './dax-cli-wrapper'

async function test() {
  console.log('Testing DAX CLI wrapper...')
  console.log('==========================================')

  try {
    console.log('Calling getContracts...')
    const result = await getContractsCli()

    console.log('\nSuccess!')
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('\nError:', error)
    process.exit(1)
  }
}

test()
