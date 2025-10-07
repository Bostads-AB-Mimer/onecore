import { createBatch } from './services/invoice-service/adapters/invoice-data-db-adapter'

const doStuff = async () => {
  createBatch(-110638241.74)
}

doStuff()
