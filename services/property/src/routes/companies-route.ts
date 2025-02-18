/**
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import { logger, generateRouteMetadata } from 'onecore-utilities'
import { getCompanies, getCompany } from '../adapters/company-adapter'
import { HttpStatusCode } from 'axios'
import { CompanySchema, CompanyDetailsSchema } from '../types/company'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Companies
 *     description: Operations related to companies
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /companies:
   *   get:
   *     summary: Get a list of all companies
   *     description: |
   *       Retrieves a list of all companies in the system.
   *       Returns the base company information
   *     tags:
   *       - Companies
   *     responses:
   *       200:
   *         description: Successfully retrieved list of companies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                  type: array
   *                  items:
   *                    $ref: '#/components/schemas/Company'
   *       500:
   *         description: Internal server error
   */
  router.get(['(.*)/companies'], async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    logger.info('GET /companies', metadata)

    try {
      const companies = await getCompanies()

      if (companies === null) {
        return (ctx.status = HttpStatusCode.NotFound)
      }

      const responseContent = companies.map((company) => {
        return CompanySchema.parse({
          ...CompanySchema.parse(company),
        })
      })

      ctx.body = { content: responseContent }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /companies/{id}:
   *   get:
   *     summary: Get detailed information about a specific company
   *     description: |
   *       Retrieves comprehensive information about a company using its unique identifier.
   *     tags:
   *       - Companies
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the company.
   *     responses:
   *       200:
   *         description: Successfully retrieved the company.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/CompanyDetails'
   *       404:
   *         description: Company not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/companies/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    logger.info(`GET /companies/${id}`, metadata)

    try {
      const company = await getCompany(ctx.params.id)

      if (!company) {
        ctx.status = 404
        return
      }

      const parsedCompanyDetails = CompanyDetailsSchema.parse({
        ...company,
      })

      ctx.body = {
        content: parsedCompanyDetails,
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
