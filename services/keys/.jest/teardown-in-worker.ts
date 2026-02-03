import { db } from '../src/services/key-service/adapters/db'

// This runs after all tests in each worker process
afterAll(async () => {
  await db.destroy()
})
