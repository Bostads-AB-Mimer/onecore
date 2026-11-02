export default async function teardown() {
  // Note: Database connection is destroyed in teardown-in-worker.ts via afterAll
  // globalTeardown runs in a separate process, so it cannot close the test worker's connections
  console.log('Test suite complete')
}
