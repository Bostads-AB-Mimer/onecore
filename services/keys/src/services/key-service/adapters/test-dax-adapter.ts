import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import crypto from 'crypto'
import fs from 'fs'
import https from 'https'
import http from 'http'

/**
 * TEST DAX API Adapter
 * Mimics the C# SignStringHelper.cs logging exactly for comparison
 * Based on: C:\Users\albram\Desktop\dax-http-sign-test\SignStringHelper.cs
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
    console.log('[TEST DAX] Using cached OAuth token')
    return cachedToken
  }

  console.log('[TEST DAX] Requesting new OAuth token')

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

    console.log('[TEST DAX] OAuth token acquired successfully')
    return cachedToken
  } catch (error: any) {
    console.error('[TEST DAX] Failed to get OAuth token:', error.message)
    throw new Error('Failed to authenticate with DAX API')
  }
}

/**
 * Build Signature Header - Mimics C# SignStringHelper.BuildSignatureHeader
 */
function buildSignatureHeader(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  console.log('[TEST DAX] Building signature header.')

  const signature = getSigningString(method, requestTarget, date, requestBody, privateKey)

  const realm = 'dax'
  const algorithm = 'SHA256withRSA'
  const headers = '(request-target) date'

  const signatureHeader = `realm="${realm}" algorithm="${algorithm}" headers="${headers}" signature="${signature}"`

  console.log('[TEST DAX] Signature header created:', signatureHeader)

  return signatureHeader
}

/**
 * Get Signing String - Mimics C# SignStringHelper.GetSigningString
 */
function getSigningString(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  console.log('[TEST DAX] Getting signing string.')
  console.log('[TEST DAX] Adding signing string - mandatory headers.')

  // Build signing string exactly like C#
  const signingStringParts: string[] = []

  // (request-target) header
  console.log('[TEST DAX] Managing header (request-target).')
  const requestTargetLine = `(request-target): ${method.toLowerCase().trim()} ${requestTarget.trim()}`
  signingStringParts.push(requestTargetLine)

  // date header
  console.log('[TEST DAX] Managing header date.')
  const dateLine = `date: ${date.trim()}`
  signingStringParts.push(dateLine)

  // Join with newlines and add request body
  console.log('[TEST DAX] Serializing request body.')
  const signingString = signingStringParts.join('\n') + '\n' + requestBody

  console.log('[TEST DAX] Signing string:')
  console.log('[TEST DAX] --------------------------------')
  console.log('[TEST DAX] >>' + signingString + '<<')
  console.log('[TEST DAX] --------------------------------')
  console.log('')
  console.log('[TEST DAX] Signing string with \\n as linebreak characters (just for display):')
  console.log('[TEST DAX] --------------------------------')
  console.log('[TEST DAX]', signingString.replace(/\n/g, '\\n'))
  console.log('[TEST DAX] --------------------------------')
  console.log('')

  const signingBytes = Buffer.from(signingString, 'utf-8')
  console.log(`[TEST DAX] Signing byte count: ${signingBytes.length} bytes`)

  // Compute SHA256 hash
  console.log('[TEST DAX] Computing sha256 hash.')
  const sha256Hash = crypto.createHash('sha256')
  const signingHash = sha256Hash.update(signingBytes).digest()

  console.log(`[TEST DAX] SHA256 hash: ${signingHash.toString('hex').toUpperCase()}`)
  console.log('[TEST DAX] Can be verified here: https://emn178.github.io/online-tools/sha256.html')

  console.log('[TEST DAX] Decoding RSA private key.')

  console.log(`[TEST DAX] Creating RSA signature with SHA256withRSA algorithm.`)
  console.log(`[TEST DAX] Signing hash length: ${signingHash.length} bytes.`)

  // C# does: rsa.SignData(signingHash, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1)
  // This signs the hash with RSA using PKCS1 padding
  // In Node.js, we need to sign the HASH directly, not use createSign which would hash again
  const privateKeyObj = crypto.createPrivateKey(privateKey)
  const signatureBytes = crypto.sign(null, signingHash, {
    key: privateKeyObj,
    padding: crypto.constants.RSA_PKCS1_PADDING
  })
  const signature = signatureBytes.toString('base64')

  console.log(`[TEST DAX] Signature: ${signature}`)

  return signature
}

/**
 * Make authenticated DAX API request
 * Mimics the C# Program.cs flow but NOW WITH REAL OAUTH
 */
async function makeAuthenticatedRequest<T>(
  method: string,
  path: string,
  context?: string
): Promise<DaxApiResponse<T>> {
  // Get access token - NOW ENABLED!
  console.log('[TEST DAX] Getting OAuth access token...')
  const token = await getAccessToken()
  console.log('[TEST DAX] Got OAuth token:', token.substring(0, 50) + '...')

  // Load private key
  const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf8')

  // Use CURRENT date (not fixed) for real request
  const now = new Date()
  const isoString = now.toISOString()
  const microSeconds = (now.getMilliseconds() * 10000).toString().padStart(7, '0')
  const date = isoString.replace(/\.\d{3}Z$/, `.${microSeconds}Z`)
  console.log('[TEST DAX] Using date:', date)

  return new Promise((resolve, reject) => {
    const url = new URL(`${Config.alliera.apiUrl}${path}`)

    // Prepare request body with context
    const requestBody = context ? JSON.stringify({ Context: context }) : '{}'

    // Build signature header using our helper
    const requestTarget = `/api/v2.0${path}` // Full path like C# uses
    const signature = buildSignatureHeader('GET', requestTarget, date, requestBody, privateKey)

    const isHttps = url.protocol === 'https:'
    const defaultPort = isHttps ? 443 : 80

    const includePort =
      url.port &&
      ((isHttps && url.port !== '443') || (!isHttps && url.port !== '80'))

    const headers: http.OutgoingHttpHeaders = {
      Host: includePort ? `${url.hostname}:${url.port}` : url.hostname,
      Authorization: `Bearer ${token}`, // NOW ENABLED!
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

    console.log('[TEST DAX] === FULL HTTP REQUEST DETAILS ===')
    console.log('[TEST DAX] Method:', method)
    console.log('[TEST DAX] URL:', url.toString())
    console.log('[TEST DAX] Headers being sent:')
    for (const [key, value] of Object.entries(headers)) {
      console.log(`[TEST DAX]   ${key}: ${value}`)
    }
    console.log('[TEST DAX] Body:', requestBody)
    console.log('[TEST DAX] ====================================')

    const requestModule = isHttps ? https : http
    const req = requestModule.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        console.log('[TEST DAX] Response status:', res.statusCode)
        console.log('[TEST DAX] Response body:', data.substring(0, 500))

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data) as DaxApiResponse<T>
            resolve(parsed)
          } catch (error) {
            console.error('[TEST DAX] Failed to parse response:', error)
            reject(error)
          }
        } else {
          console.error('[TEST DAX] Request failed with status:', res.statusCode)
          console.error('[TEST DAX] Response body:', data)
          reject(new Error(`DAX API request failed: ${res.statusCode}`))
        }
      })
    })

    req.removeHeader('Connection')

    req.on('error', (error) => {
      console.error('[TEST DAX] Request error:', error)
      reject(error)
    })

    if (requestBody) {
      req.write(requestBody)
    }

    req.end()
  })
}

/**
 * Get all contracts - Test endpoint
 */
export async function getContracts(): Promise<ContractsResponse> {
  console.log('[TEST DAX] ======================================')
  console.log('[TEST DAX] Fetching contracts from DAX API')
  console.log('[TEST DAX] ======================================')

  const response = await makeAuthenticatedRequest<ContractsResponse>(
    'GET',
    '/contracts',
    'Testrequest'
  )

  console.log('[TEST DAX] Successfully fetched contracts')

  return response.data
}
