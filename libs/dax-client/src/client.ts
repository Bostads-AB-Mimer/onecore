/**
 * DAX API Client
 */

import http from 'http'
import https from 'https'
import { getAccessToken } from './auth/oauth'
import { buildSignatureHeader, generateDaxDate } from './auth/signature'
import type { DaxApiResponse, DaxClientConfig } from './types'

export class DaxClient {
  constructor(private config: DaxClientConfig) {}

  /**
   * Make authenticated request to DAX API
   */
  async request<T>(
    method: string,
    path: string,
    options?: {
      context?: string
      queryParams?: Record<string, string | number | undefined>
    }
  ): Promise<T> {
    const token = await getAccessToken({
      apiUrl: this.config.apiUrl,
      clientId: this.config.clientId,
      username: this.config.username,
      password: this.config.password,
    })

    // Build query string
    let fullPath = path
    let queryString = ''
    if (options?.queryParams) {
      console.log('[DAX] Query params:', JSON.stringify(options.queryParams))
      queryString = this.buildQueryString(options.queryParams)
      console.log('[DAX] Query string:', queryString)
      if (queryString) {
        fullPath += `?${queryString}`
      }
    }

    // Prepare request body with context
    const requestBody = options?.context
      ? JSON.stringify({ Context: options.context })
      : '{}'

    // Generate date with microsecond precision
    const date = generateDaxDate()

    // Build signature header
    // IMPORTANT: DAX API expects signature to be calculated WITHOUT query parameters in request target
    // Query params are still sent in the actual HTTP request, just not included in signature
    const apiVersion = this.config.apiVersion || '2.0'
    const requestTarget = `/api/v${apiVersion}${path}` // Use path WITHOUT query string
    const signature = buildSignatureHeader(
      method,
      requestTarget,
      date,
      requestBody,
      this.config.privateKey
    )

    return new Promise((resolve, reject) => {
      const fullUrl = `/api/v${apiVersion}${fullPath}`
      const url = new URL(`${this.config.apiUrl}${fullUrl}`)

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

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || defaultPort,
        path: fullUrl, // Use fullUrl with query params for actual HTTP request
        method: method,
        headers: headers,
        agent: isHttps
          ? new https.Agent({ keepAlive: false })
          : new http.Agent({ keepAlive: false }),
        setHost: false,
      }

      const requestModule = isHttps ? https : http
      const req = requestModule.request(requestOptions, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data) as DaxApiResponse<T>
              resolve(parsed.data)
            } catch (error) {
              console.error('[DAX] Failed to parse response:', error)
              reject(error)
            }
          } else {
            console.error(`[DAX] Request failed with status: ${res.statusCode}`)
            console.error(`[DAX] Response body: ${data}`)
            reject(
              new Error(
                `DAX API request failed: ${res.statusCode} - ${data}`
              )
            )
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
   * Build query string from params object
   */
  private buildQueryString(
    params: Record<string, string | number | undefined>
  ): string {
    const parts: string[] = []

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        parts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(value.toString())}`
        )
      }
    }

    return parts.join('&')
  }
}
