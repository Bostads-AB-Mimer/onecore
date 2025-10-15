export default async function teardown() {
  // Cleanup tasks after all tests complete
  // Currently just a placeholder - database connections are closed in withContext
  console.log('Test suite complete')
}
