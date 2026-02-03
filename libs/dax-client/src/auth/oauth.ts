/**
 * OAuth authentication for DAX API
 */

import http from 'http'
import https from 'https'

interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface OAuthConfig {
  apiUrl: string
  clientId: string
  username: string
  password: string
}

// Token cache
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

/**
 * Get OAuth access token (with caching)
 */
export async function getAccessToken(config: OAuthConfig): Promise<string> {
  const now = Date.now()

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken
  }

  try {
    const body = `client_id=${config.clientId}&grant_type=password&password=${config.password}&username=${config.username}`

    const url = new URL(`${config.apiUrl}/oauth/token`)
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
 * Clear cached token (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  cachedToken = null
  tokenExpiresAt = 0
}
