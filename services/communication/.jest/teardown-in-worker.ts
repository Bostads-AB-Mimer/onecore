import { db } from '../src/common/db'

// Runs after all tests in each worker process. globalTeardown runs in a
// separate process and cannot close the worker's connection pool.
afterAll(async () => {
  await db.destroy()
})
