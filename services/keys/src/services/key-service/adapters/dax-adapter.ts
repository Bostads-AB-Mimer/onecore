import Config from '../../../common/config'
import crypto from 'crypto'
import fs from 'fs'
import https from 'https'
import http from 'http'

/**
 * DAX API Adapter
 * Direct TypeScript implementation with OAuth and RSA signature authentication
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

export interface ContractsResponse {
  contracts: any[]
}

/**
 * Get OAuth access token
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now()

  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken
  }

  try {
    const body = `client_id=${Config.alliera.clientId}&grant_type=password&password=${Config.alliera.password}&username=${Config.alliera.username}`

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

    return cachedToken
  } catch (error: any) {
    console.error('[DAX] Failed to get OAuth token:', error.message)
    throw new Error('Failed to authenticate with DAX API')
  }
}

/**
 * Build Signature Header
 */
function buildSignatureHeader(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  const signature = getSigningString(
    method,
    requestTarget,
    date,
    requestBody,
    privateKey
  )

  const realm = 'dax'
  const algorithm = 'SHA256withRSA'
  const headers = '(request-target) date'

  return `realm="${realm}" algorithm="${algorithm}" headers="${headers}" signature="${signature}"`
}

/**
 * Get Signing String - Creates RSA signature
 */
function getSigningString(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  // Build signing string exactly like C#
  const signingStringParts: string[] = []

  // (request-target) header
  const requestTargetLine = `(request-target): ${method.toLowerCase().trim()} ${requestTarget.trim()}`
  signingStringParts.push(requestTargetLine)

  // date header
  const dateLine = `date: ${date.trim()}`
  signingStringParts.push(dateLine)

  // Join with newlines and add request body
  const signingString = signingStringParts.join('\n') + '\n' + requestBody

  const signingBytes = Buffer.from(signingString, 'utf-8')

  // Compute SHA256 hash
  const sha256Hash = crypto.createHash('sha256')
  const signingHash = sha256Hash.update(signingBytes).digest()

  // Sign the hash with RSA using PKCS1 padding
  const privateKeyObj = crypto.createPrivateKey(privateKey)
  const signatureBytes = crypto.sign(null, signingHash, {
    key: privateKeyObj,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  })
  const signature = signatureBytes.toString('base64')

  return signature
}

/**
 * Make authenticated DAX API request
 */
async function makeAuthenticatedRequest<T>(
  method: string,
  path: string,
  context?: string
): Promise<DaxApiResponse<T>> {
  const token = await getAccessToken()

  // Load private key
  const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf8')

  // Create date in ISO format with microsecond precision
  const now = new Date()
  const isoString = now.toISOString()
  const microSeconds = (now.getMilliseconds() * 10000)
    .toString()
    .padStart(7, '0')
  const date = isoString.replace(/\.\d{3}Z$/, `.${microSeconds}Z`)

  return new Promise((resolve, reject) => {
    const url = new URL(`${Config.alliera.apiUrl}${path}`)

    // Prepare request body with context
    const requestBody = context ? JSON.stringify({ Context: context }) : '{}'

    // Build signature header using our helper
    const requestTarget = `/api/v2.0${path}` // Full path like C# uses
    const signature = buildSignatureHeader(
      'GET',
      requestTarget,
      date,
      requestBody,
      privateKey
    )

    const isHttps = url.protocol === 'https:'
    const defaultPort = isHttps ? 443 : 80

    const includePort =
      url.port &&
      ((isHttps && url.port !== '443') || (!isHttps && url.port !== '80'))

    const headers: http.OutgoingHttpHeaders = {
      Host: includePort ? `${url.hostname}:${url.port}` : url.hostname,
      Authorization: `Bearer ${token}`,
      Date: date,
      Signature: signature,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(requestBody, 'utf8'),
    }

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || defaultPort,
      path: `/api/v2.0${path}`,
      method: method,
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
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data) as DaxApiResponse<T>
            resolve(parsed)
          } catch (error) {
            console.error('[DAX] Failed to parse response:', error)
            reject(error)
          }
        } else {
          console.error(`[DAX] Request failed with status: ${res.statusCode}`)
          reject(new Error(`DAX API request failed: ${res.statusCode}`))
        }
      })
    })

    req.removeHeader('Connection')

    req.on('error', (error) => {
      console.error('[DAX] Request error:', error)
      reject(error)
    })

    if (requestBody) {
      req.write(requestBody)
    }

    req.end()
  })
}

/**
 * Get all contracts
 */
export async function getContracts(): Promise<ContractsResponse> {
  const response = await makeAuthenticatedRequest<ContractsResponse>(
    'GET',
    '/contracts',
    'Testrequest'
  )

  return response.data
}

// Placeholder exports for card owners functionality
export interface CardOwner {
  cardOwnerId: string
  [key: string]: any
}

export interface CardOwnerResponse {
  cardOwner: CardOwner
}

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

export async function getCardOwner(
  _partnerId: string,
  _instanceId: string,
  _cardOwnerId: string
): Promise<CardOwnerResponse> {
  throw new Error('getCardOwner not yet implemented in new DAX adapter')
}

export async function queryCardOwners(
  _params: QueryCardOwnersParams
): Promise<QueryCardOwnersResponse> {
  throw new Error('queryCardOwners not yet implemented in new DAX adapter')
}
