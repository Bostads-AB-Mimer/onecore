import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { prismaErrorCode } from '../utils/prisma-errors'

const MAX_ATTEMPTS = 3

// SQL Server resolves a serializable conflict by killing one side as a
// deadlock victim (P2034); a retry re-reads the state the winner committed.
export const serializable = async <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || prismaErrorCode(err) !== 'P2034') {
        throw err
      }
    }
  }
}
