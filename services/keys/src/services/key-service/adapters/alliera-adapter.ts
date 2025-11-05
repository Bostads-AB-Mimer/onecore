import { logger } from '@onecore/utilities'
import Config from '../../../common/config'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'

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
  const signingParts: string[] = []

  // Add (request-target) - mandatory
  signingParts.push(`(request-target): ${method.toLowerCase()} ${path}`)

  // Add other headers in order
  const headerNames: string[] = []
  headerNames.push('(request-target)')

  // Add host if present
  if (headers['host']) {
    signingParts.push(`host: ${headers['host']}`)
    headerNames.push('host')
  }

  // Add date - mandatory
  if (headers['date']) {
    signingParts.push(`date: ${headers['date']}`)
    headerNames.push('date')
  }

  // Add content-type if present
  if (headers['content-type']) {
    signingParts.push(`content-type: ${headers['content-type']}`)
    headerNames.push('content-type')
  }

  // Add content-length if present
  if (headers['content-length']) {
    signingParts.push(`content-length: ${headers['content-length']}`)
    headerNames.push('content-length')
  }

  // Build final signing string with newlines
  // NOTE: Each header line ends with \n, but the last line only gets \n if there's a body
  let signingString = signingParts.join('\n')

  // If there's a body, add newline then the body (no trailing newline)
  if (body) {
    signingString += '\n' + body
  }

  logger.info(
    {
      headerNames: headerNames.join(' '),
      signingStringLength: signingString.length,
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

    // Prepare GET request (no body for GET)
    const method = 'GET'
    const path = `/api/v2.0/partners/${Config.alliera.partnerId}/instances/${instanceId}/cardowners/${cardOwnerId}`

    // Generate ISO-8601 date with timezone
    const date = new Date().toISOString().replace('Z', '+00:00')

    // Extract host from API URL
    const apiHost = new URL(Config.alliera.apiUrl).host

    // Prepare headers for signature
    const headers: Record<string, string> = {
      'date': date,
      'host': apiHost,
    }

    // Generate signature
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
      },
      'Fetching card owner from DAX API'
    )

    // Make the signed GET request
    const response = await axios.get(
      `${Config.alliera.apiUrl}${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Signature': signatureHeader,
          'Date': date,
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    )

    logger.info(
      {
        status: response.status,
        dataLength: JSON.stringify(response.data).length,
      },
      'Successfully fetched card owners'
    )

    return response.data
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
