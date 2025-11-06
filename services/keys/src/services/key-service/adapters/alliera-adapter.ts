import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import https from 'https'

/**
 * Alliera API adapter
 * Handles OAuth token authentication and request signing for Alliera DAX API
 */

interface AllieraTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

interface SignatureParams {
  method: string
  path: string
  headers: Record<string, string>
  body?: string
}

/**
 * Generate DAX API signature for request authentication
 * Uses SHA256withRSA algorithm to sign requests
 * @param params - Signature parameters including method, path, headers, and optional body
 * @returns Complete Signature header value
 */
function generateSignature(params: SignatureParams): string {
  const { method, path, headers, body } = params

  // Read private key from PEM file
  const privateKey = fs.readFileSync(Config.alliera.pemKeyPath, 'utf8')

  // Build signing string according to DAX specification
  // Format: each line is "header-name: value\n"
  // Order matters! Per documentation example (lines 867-872): (request-target), host, date, [cache-control], content-length
  const signingParts: string[] = []
  const headerNames: string[] = []

  // Add (request-target) - mandatory and must be first
  signingParts.push(`(request-target): ${method.toLowerCase()} ${path}`)
  headerNames.push('(request-target)')

  // Add host if present - should be second per documentation examples
  if (headers['host']) {
    signingParts.push(`host: ${headers['host']}`)
    headerNames.push('host')
  }

  // Add date - mandatory, after host
  if (headers['date']) {
    signingParts.push(`date: ${headers['date']}`)
    headerNames.push('date')
  }

  // Add content-type if present - before content-length
  if (headers['content-type']) {
    signingParts.push(`content-type: ${headers['content-type']}`)
    headerNames.push('content-type')
  }

  // Add content-length if present - after content-type per POST example
  if (headers['content-length']) {
    signingParts.push(`content-length: ${headers['content-length']}`)
    headerNames.push('content-length')
  }

  // Build final signing string with newlines
  // Per DAX spec: "All values in the string should end with a newline \n character"
  // Each header line ends with \n including the last one
  let signingString = signingParts.join('\n') + '\n'

  // If there's a body (POST/PUT requests), append it after the last header newline
  // The body itself has no trailing newline
  if (body) {
    signingString += body
  }

  // Detailed logging for debugging signature issues
  console.log('\n=== SIGNING STRING DEBUG ===')
  console.log('Full signing string:')
  console.log(JSON.stringify(signingString))
  console.log('\nSigning string length:', signingString.length)
  console.log('Headers signed:', headerNames.join(' '))
  console.log('=== END SIGNING STRING ===\n')

  logger.info(
    {
      headerNames: headerNames.join(' '),
      signingStringLength: signingString.length,
      signingStringPreview: signingString.substring(0, 200),
      signingStringHex: Buffer.from(signingString, 'utf-8').toString('hex').substring(0, 100),
      hasBody: !!body,
      bodyLength: body ? body.length : 0,
    },
    'Generating DAX signature'
  )

  // Sign with SHA256withRSA
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(Buffer.from(signingString, 'utf-8'))
  sign.end()

  const signature = sign.sign(privateKey, 'base64')

  // Build signature header value
  const signatureHeader = [
    'realm="dax"',
    'algorithm="sha256withrsa"',
    `headers="${headerNames.join(' ')}"`,
    `signature="${signature}"`,
  ].join(' ')

  return signatureHeader
}

/**
 * Fetch OAuth bearer token from Alliera API
 * POST /oauth/token with password grant type
 * Token expires after 1800 seconds (30 minutes)
 */
export async function fetchAllieraToken(): Promise<string> {
  try {
    logger.info(
      {
        apiUrl: Config.alliera.apiUrl,
        hasClientId: !!Config.alliera.clientId,
        hasUsername: !!Config.alliera.username,
      },
      'Fetching Alliera OAuth token'
    )

    // Prepare form-urlencoded data
    const formData = new URLSearchParams()
    formData.append('username', Config.alliera.username)
    formData.append('password', Config.alliera.password)
    formData.append('client_id', Config.alliera.clientId)
    formData.append('grant_type', 'password')

    const response = await axios.post<AllieraTokenResponse>(
      `${Config.alliera.apiUrl}/oauth/token`,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    logger.info(
      {
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
      },
      'Successfully fetched Alliera token'
    )

    return response.data.access_token
  } catch (error: any) {
    logger.error(
      {
        error: error.response?.data || error.message,
        status: error.response?.status,
      },
      'Alliera token fetch error'
    )
    throw new Error(
      `Alliera authentication error: ${error.response?.status || 'unknown'}`
    )
  }
}

/**
 * Fetch a specific card owner from DAX API
 * GET /api/v2.0/partners/{partnerId}/instances/{instanceId}/cardowners/{cardOwnerId}
 * Requires signed request with bearer token
 * @param cardOwnerId - The card owner ID to fetch
 * @param owningInstanceId - Optional instance ID, defaults to clientId from config
 */
export async function getCardOwners(
  cardOwnerId: string = '1b385f32-c2c2-4a17-a116-97a32bdca382',
  owningInstanceId?: string
): Promise<any> {
  try {
    // Use provided instanceId or default to clientId (they are the same)
    const instanceId = owningInstanceId || Config.alliera.clientId

    // First, fetch the bearer token
    const token = await fetchAllieraToken()

    // WORKAROUND: DAX API requires request body for GET endpoints (per OpenAPI spec)
    // but HTTP GET with body is non-standard. Since OpenAPI shows requestBody,
    // we'll send as GET but with proper body signing.
    // Using the lower-level axios.request() method which CAN send body with GET
    const method = 'GET'
    const path = `/api/v2.0/partners/${Config.alliera.partnerId}/instances/${instanceId}/cardowners/${cardOwnerId}`

    // Generate ISO-8601 date with timezone as required by DAX spec
    // Format: 2020-05-17T14:44:30+02:00 (without milliseconds)
    const date = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')

    // Extract host from API URL
    const apiHost = new URL(Config.alliera.apiUrl).host

    // Create request body as required by OpenAPI spec
    // Note: field is lowercase "context" per schema Amido.Dax.Contracts.CardOwners.GetCardOwnerRequest
    // IMPORTANT: NO whitespace in JSON - must be compact
    const requestBody = JSON.stringify({ context: 'GetCardOwner' })
    const contentLength = Buffer.byteLength(requestBody, 'utf-8').toString()

    // Prepare headers for signature
    // Try minimal headers for GET: just (request-target), host, and date
    const headers: Record<string, string> = {
      'host': apiHost,
      'date': date,
      // Don't include content-length or content-type in signature
    }

    // Generate signature WITHOUT body and WITHOUT content-length
    const signatureHeader = generateSignature({
      method,
      path,
      headers,
    })

    logger.info(
      {
        partnerId: Config.alliera.partnerId,
        instanceId: instanceId,
        cardOwnerId: cardOwnerId,
        path,
        signatureHeader: signatureHeader.substring(0, 150) + '...',
      },
      'Fetching card owner from DAX API'
    )

    // Use native Node.js https module since axios cannot send body with GET
    // DAX API requires GET requests to include a body (per documentation lines 541-546)
    return new Promise((resolve, reject) => {
      const url = new URL(Config.alliera.apiUrl)

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: path,
        method: 'GET',
        headers: {
          'authorization': `Bearer ${token}`,
          'signature': signatureHeader,
          'date': date,
          'host': apiHost,
          'content-type': 'application/json; charset=utf-8',
          'content-length': contentLength,
        },
      }

      console.log('\n=== HTTPS REQUEST DEBUG ===')
      console.log('Method:', options.method)
      console.log('URL:', `https://${options.hostname}${options.path}`)
      console.log('Request headers:', JSON.stringify(options.headers, null, 2))
      console.log('Request body:', requestBody)
      console.log('Request body length:', Buffer.byteLength(requestBody, 'utf-8'))
      console.log('=== END REQUEST DEBUG ===\n')

      const req = https.request(options, (res) => {
        let data = ''

        console.log('\n=== HTTPS RESPONSE DEBUG ===')
        console.log('Status:', res.statusCode, res.statusMessage)
        console.log('Response headers:', JSON.stringify(res.headers, null, 2))
        console.log('=== END RESPONSE DEBUG ===\n')

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            logger.info(
              {
                status: res.statusCode,
                dataLength: data.length,
              },
              'Successfully fetched card owners'
            )

            try {
              const jsonData = JSON.parse(data)
              resolve(jsonData)
            } catch (_parseError) {
              resolve(data)
            }
          } else {
            logger.error(
              {
                status: res.statusCode,
                statusMessage: res.statusMessage,
                responseBody: data,
              },
              'DAX API error response'
            )
            reject(
              new Error(
                `DAX API error: ${res.statusCode} ${res.statusMessage} - ${data}`
              )
            )
          }
        })
      })

      req.on('error', (error) => {
        logger.error(
          {
            error: error.message,
          },
          'HTTPS request error'
        )
        reject(new Error(`HTTPS request error: ${error.message}`))
      })

      // Write the request body with GET method
      req.write(requestBody)
      req.end()
    })
  } catch (error: any) {
    logger.error(
      {
        error: error.response?.data || error.message,
        status: error.response?.status,
        headers: error.response?.headers,
      },
      'DAX API error fetching card owners'
    )
    throw new Error(
      `DAX API error: ${error.response?.status || 'unknown'} - ${
        error.response?.data?.message || error.message
      }`
    )
  }
}
