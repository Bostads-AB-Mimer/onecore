import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import crypto from 'crypto'
import fs from 'fs'
import https from 'https'
import http from 'http'

/**
 * DAX API Adapter
 * Handles communication with Amido DAX API for access control
 * Implements OAuth authentication and HTTP message signing with SHA256withRSA
 */

// OAuth token storage
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface DaxApiResponse<T> {
  apiVersion: string
  correlationId: string
  statusCode: number
  message: string | null
  paging?: {
    totalCount: number
    offset: number
    limit: number
  }
  data: T
}

// Contract types
export interface Contract {
  contractId: string
  promisee: {
    partnerId: string
    name: string
  }
  promisor: {
    partnerId: string
    name: string
  }
  accessControlInstance: {
    accessControlInstanceId: string
    name: string
    description: string
    lastActiveUtc: string | null
    clientVersion: string | null
  }
  state: string
  createdOn: string
  signedOn: string
  validityPeriod: string | null
  endsOn: string | null
  clauses: Array<{
    clause: string
    property: string
    value: string
  }>
  tags: Array<{
    value: string
  }>
}

export interface ContractsResponse {
  contracts: Contract[]
}

// Card Owner types
export interface CardOwner {
  cardOwnerId: string
  owningPartner: {
    partnerId: string
    name: string
  }
  owningInstance: {
    instanceId: string
    name: string
  }
  organizationId: string | null
  firstname: string
  lastname: string
  email: string | null
  mobile: string | null
  personnummer: string | null
  address: string | null
  city: string | null
  zipcode: string | null
  cards: Array<{
    cardId: string
    cardNumber: string
    cardType: string
    validFrom: string
    validTo: string | null
    state: string
  }>
}

export interface CardOwnerResponse {
  cardOwner: CardOwner
}

/**
 * Get OAuth access token
 * Uses cached token if still valid, otherwise requests new token
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt > now + 60000) {
    logger.debug('Using cached DAX access token')
    return cachedToken
  }

  logger.debug('Requesting new DAX access token')

  console.log('=== DAX CONFIG DEBUG ===')
  console.log('Config values:', {
    apiUrl: Config.alliera.apiUrl,
    hasUsername: !!Config.alliera.username,
    hasPassword: !!Config.alliera.password,
    hasClientId: !!Config.alliera.clientId,
    usernameLength: Config.alliera.username?.length,
    passwordLength: Config.alliera.password?.length,
    clientIdLength: Config.alliera.clientId?.length,
  })
  console.log('Direct env check:', {
    directUsername: !!process.env.ALLIERA__USERNAME,
    directPassword: !!process.env.ALLIERA__PASSWORD,
    directClientId: !!process.env.ALLIERA__CLIENT_ID,
  })
  console.log('========================')

  try {
    // OAuth endpoints typically expect form-urlencoded data
    const body = `client_id=${Config.alliera.clientId}&grant_type=password&password=${Config.alliera.password}&username=${Config.alliera.username}`

    console.log('Payload being sent:', body)

    const url = new URL(`${Config.alliera.apiUrl}/oauth/token`)
    const isHttps = url.protocol === 'https:'
    const defaultPort = isHttps ? 443 : 80

    const response = await new Promise<OAuthTokenResponse>(
      (resolve, reject) => {
        const headers: http.OutgoingHttpHeaders = {
          Host:
            url.hostname +
            (url.port && url.port !== defaultPort.toString()
              ? `:${url.port}`
              : ''),
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        }

        const options: http.RequestOptions = {
          hostname: url.hostname,
          port: url.port || defaultPort,
          path: url.pathname,
          method: 'POST',
          headers: headers,
          agent: isHttps
            ? new https.Agent({ keepAlive: false })
            : new http.Agent({ keepAlive: false }),
          setHost: false,
        }

        const requestModule = isHttps ? https : http
        const req = requestModule.request(options, (res) => {
          let data = ''

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              try {
                const parsed = JSON.parse(data) as OAuthTokenResponse
                resolve(parsed)
              } catch (error) {
                reject(error)
              }
            } else {
              reject(new Error(`OAuth request failed: ${res.statusCode}`))
            }
          })
        })

        // Remove the Connection header that Node.js adds automatically
        req.removeHeader('Connection')

        req.on('error', (error) => {
          reject(error)
        })

        req.write(body)
        req.end()
      }
    )

    cachedToken = response.access_token
    tokenExpiresAt = now + response.expires_in * 1000

    console.log('=== OAUTH TOKEN RECEIVED ===')
    console.log('Token length:', cachedToken?.length)
    console.log('Token (first 50 chars):', cachedToken?.substring(0, 50))
    console.log('Full token:', cachedToken)
    console.log('============================')

    logger.debug('DAX access token acquired successfully')
    return cachedToken
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get DAX access token')
    throw new Error('Failed to authenticate with DAX API')
  }
}

/**
 * Create HTTP signature header
 * Implements SHA256withRSA signature algorithm as required by DAX API
 */
function createSignatureHeader(
  method: string,
  path: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  // Build signing string - Includes (request-target), date, AND request body
  // DAX docs: "Always trim the value before adding it"
  const requestTarget = `${method.toLowerCase().trim()} ${path.trim()}`
  // HTTP Signatures spec uses \n (LF), not \r\n (CRLF)
  // The request body is appended after the headers
  const signingString = `(request-target): ${requestTarget}\ndate: ${date.trim()}\n${requestBody}`

  // Check for any unexpected whitespace
  console.log('=== WHITESPACE CHECK ===')
  console.log('Method has whitespace:', method !== method.trim())
  console.log('Path has whitespace:', path !== path.trim())
  console.log('Date has whitespace:', date !== date.trim())
  console.log('=========================')

  console.log('=== NODE.JS SIGNING STRING ===')
  console.log(signingString)
  console.log('=== SIGNING STRING AS BYTES ===')
  console.log(Buffer.from(signingString, 'utf-8').toString('hex'))
  console.log('==============================')

  logger.debug({ signingString }, 'Creating signature for request')

  // FIX: C# does rsa.SignData(hash, SHA256, PKCS1) which signs the HASH
  // We need to: 1) Hash the signing string, 2) Sign the hash with RSA
  const signingBytes = Buffer.from(signingString, 'utf-8')
  const sha256Hash = crypto.createHash('sha256')
  const signingHash = sha256Hash.update(signingBytes).digest()

  console.log('=== SHA256 HASH ===')
  console.log(signingHash.toString('hex').toUpperCase())
  console.log('===================')

  // Sign the hash directly with RSA using PKCS1 padding (not createSign which would hash again)
  const privateKeyObj = crypto.createPrivateKey(privateKey)
  const signatureBytes = crypto.sign(null, signingHash, {
    key: privateKeyObj,
    padding: crypto.constants.RSA_PKCS1_PADDING
  })
  const signature = signatureBytes.toString('base64')

  console.log('=== NODE.JS SIGNATURE ===')
  console.log(signature)
  console.log('=========================')

  // Build signature header - ONLY (request-target) and date are signed, NOT content-length
  const signatureHeader = `realm="dax" algorithm="SHA256withRSA" headers="(request-target) date" signature="${signature}"`

  return signatureHeader
}

/**
 * Make authenticated DAX API request using Node.js native https module
 * Mimics .NET HttpClient behavior
 */
async function makeAuthenticatedRequest<T>(
  method: string,
  path: string,
  body?: any
): Promise<DaxApiResponse<T>> {
  // Get access token
  const token = await getAccessToken()

  console.log('=== TOKEN BEING USED IN REQUEST ===')
  console.log('Token exists:', !!token)
  console.log('Token length:', token?.length)
  console.log('Token (first 50 chars):', token?.substring(0, 50))
  console.log('===================================')

  // Load private key
  const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf8')

  // Create date header in ISO-8601 format with 7 decimal places to match .NET
  // .NET uses DateTime.UtcNow.ToString("o") which gives 7 decimal places
  const now = new Date()
  const isoString = now.toISOString() // gives 3 decimal places
  // Convert to 7 decimal places by adding microseconds (always 0 in JS) + tenth of microsecond
  const microSeconds = (now.getMilliseconds() * 10000)
    .toString()
    .padStart(7, '0')
  const date = isoString.replace(/\.\d{3}Z$/, `.${microSeconds}Z`)

  return new Promise((resolve, reject) => {
    const url = new URL(`${Config.alliera.apiUrl}${path}`)

    // Prepare body - .NET DAX SDK sends body even for GET requests
    let bodyString = ''
    if (body) {
      bodyString = JSON.stringify(body)
    }

    // Create signature header - Signs (request-target), date, AND request body
    const signature = createSignatureHeader(method, path, date, bodyString, privateKey)

    // Determine if we're using HTTP or HTTPS based on the URL protocol
    const isHttps = url.protocol === 'https:'
    const defaultPort = isHttps ? 443 : 80

    // Build headers exactly like .NET HttpClient
    // Only include port in Host header if it's non-standard (not 80 for HTTP, not 443 for HTTPS)
    const includePort =
      url.port &&
      ((isHttps && url.port !== '443') || (!isHttps && url.port !== '80'))
    const headers: http.OutgoingHttpHeaders = {
      Host: includePort ? `${url.hostname}:${url.port}` : url.hostname,
      Authorization: token ? `Bearer ${token}` : 'Bearer',
      Date: date,
      Signature: signature,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(bodyString, 'utf8'),
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || defaultPort,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
      // Prevent Node.js from adding Connection header
      agent: isHttps
        ? new https.Agent({ keepAlive: false })
        : new http.Agent({ keepAlive: false }),
      setHost: false, // Don't auto-add Host header since we're setting it manually
    }

    console.log('=== FULL HTTP REQUEST DETAILS ===')
    console.log('Method:', method)
    console.log('URL:', url.toString())
    console.log('Headers being sent:')
    for (const [key, value] of Object.entries(headers)) {
      console.log(`  ${key}: ${value}`)
    }
    console.log('Body:', bodyString || '(empty)')
    console.log('==================================')

    logger.debug(
      { options, protocol: url.protocol },
      `Making ${isHttps ? 'HTTPS' : 'HTTP'} request`
    )

    const requestModule = isHttps ? https : http
    const req = requestModule.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        logger.debug(
          { statusCode: res.statusCode, body: data.substring(0, 500) },
          'Response received'
        )

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data) as DaxApiResponse<T>
            resolve(parsed)
          } catch (error) {
            logger.error({ error, data }, 'Failed to parse response')
            reject(error)
          }
        } else {
          logger.error(
            { statusCode: res.statusCode, body: data, path },
            'DAX API request failed'
          )
          reject(new Error(`DAX API request failed: ${res.statusCode}`))
        }
      })
    })

    // Remove the Connection header that Node.js adds automatically
    req.removeHeader('Connection')

    req.on('error', (error) => {
      logger.error({ error, path }, 'Request error')
      reject(error)
    })

    if (bodyString) {
      req.write(bodyString)
    }

    req.end()
  })
}

/**
 * Get all contracts
 * GET /api/v2.0/contracts
 */
export async function getContracts(): Promise<ContractsResponse> {
  logger.info('Fetching contracts from DAX API')

  // .NET DAX SDK sends a body even for GET requests with context
  const response = await makeAuthenticatedRequest<ContractsResponse>(
    'GET',
    '/api/v2.0/contracts',
    { Context: 'GetContracts' }
  )

  logger.info(
    { count: response.data.contracts.length },
    'Successfully fetched contracts'
  )

  return response.data
}

/**
 * Get specific card owner
 * GET /api/v2.0/partners/{partnerId}/instances/{instanceId}/cardowners/{cardOwnerId}
 */
export async function getCardOwner(
  partnerId: string,
  instanceId: string,
  cardOwnerId: string
): Promise<CardOwnerResponse> {
  logger.info(
    { partnerId, instanceId, cardOwnerId },
    'Fetching card owner from DAX API'
  )

  const path = `/api/v2.0/partners/${partnerId}/instances/${instanceId}/cardowners/${cardOwnerId}`

  const response = await makeAuthenticatedRequest<CardOwnerResponse>(
    'GET',
    path
  )

  logger.info(
    { cardOwnerId: response.data.cardOwner.cardOwnerId },
    'Successfully fetched card owner'
  )

  return response.data
}

/**
 * Query card owners
 * POST /api/v2.0/cardowners/query
 */
export interface QueryCardOwnersParams {
  partnerId?: string
  instanceId?: string
  firstname?: string
  lastname?: string
  email?: string
  personnummer?: string
  offset?: number
  limit?: number
}

export interface QueryCardOwnersResponse {
  cardOwners: CardOwner[]
}

export async function queryCardOwners(
  params: QueryCardOwnersParams
): Promise<QueryCardOwnersResponse> {
  logger.info({ params }, 'Querying card owners from DAX API')

  const response = await makeAuthenticatedRequest<QueryCardOwnersResponse>(
    'POST',
    '/api/v2.0/cardowners/query',
    params
  )

  logger.info(
    { count: response.data.cardOwners.length },
    'Successfully queried card owners'
  )

  return response.data
}
