import * as daxAdapter from './src/services/key-service/adapters/dax-adapter'
import 'dotenv/config'

async function testApiCall() {
  console.log('=== Testing DAX API Call ===\n')

  console.log('Configuration:')
  console.log('  API URL:', process.env.ALLIERA__API_URL)
  console.log('  Username:', process.env.ALLIERA__USERNAME)
  console.log('  Client ID:', process.env.ALLIERA__CLIENT_ID)
  console.log('  PEM Key Path:', process.env.ALLIERA__PEM_KEY_PATH)
  console.log()

  try {
    console.log('Calling getContracts()...')
    const result = await daxAdapter.getContracts()
    console.log('\n✓ SUCCESS!')
    console.log('Number of contracts:', result.contracts.length)
    console.log('\nFirst contract:')
    console.log(JSON.stringify(result.contracts[0], null, 2))
  } catch (error: any) {
    console.error('\n✗ FAILED!')
    console.error('Error:', error.message)
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Response:', error.response.data)
    }
    console.error('\nFull error:', error)
  }
}

testApiCall()
