import {
  fetchAllieraToken,
  getCardOwners,
} from './src/services/key-service/adapters/alliera-adapter'

async function testToken() {
  try {
    console.log('=== Testing Alliera Token Fetching ===')
    const token = await fetchAllieraToken()
    console.log('✓ Token fetched successfully!')
    console.log('Token length:', token.length)
    console.log('Token preview:', token.substring(0, 20) + '...')
    console.log()
  } catch (error: any) {
    console.error('✗ Failed to fetch token:', error.message)
    process.exit(1)
  }
}

async function testCardOwners() {
  try {
    console.log('=== Testing Card Owners with Signed Request ===')
    console.log('Using instance ID from config (clientId)...')

    // Call without parameters to use clientId from config
    const cardOwners = await getCardOwners()

    console.log('✓ Card owners fetched successfully!')
    console.log('Response:', JSON.stringify(cardOwners, null, 2))
  } catch (error: any) {
    console.error('✗ Failed to fetch card owners:', error.message)
    // Don't exit - this might fail with test data
  }
}

async function runTests() {
  await testToken()
  await testCardOwners()
}

runTests()
