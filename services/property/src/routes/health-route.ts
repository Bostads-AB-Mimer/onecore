import KoaRouter from '@koa/router'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const routes = (router: KoaRouter) => {
  router.get('/health', async (ctx) => {
    try {
      await prisma.$connect()
      ctx.status = 200
      ctx.body = { status: 'healthy' }
    } catch (error) {
      ctx.status = 500
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      ctx.body = {
        status: 'unhealthy',
        error: errorMessage,
        message: 'Do you have the VPN running?',
      }
    } finally {
      await prisma.$disconnect()
    }
  })
}
