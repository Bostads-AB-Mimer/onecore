/**
 * RSA signature generation for DAX API
 */

import crypto from 'crypto'

/**
 * Build Signature Header for DAX API authentication
 */
export function buildSignatureHeader(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  const signature = signRequest(
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
 * Sign request with RSA private key
 * Creates SHA256 hash and signs it with RSA PKCS1 padding
 */
function signRequest(
  method: string,
  requestTarget: string,
  date: string,
  requestBody: string,
  privateKey: string
): string {
  // Build signing string
  const signingStringParts: string[] = []

  // (request-target) header
  const requestTargetLine = `(request-target): ${method.toLowerCase().trim()} ${requestTarget.trim()}`
  signingStringParts.push(requestTargetLine)

  // date header
  const dateLine = `date: ${date.trim()}`
  signingStringParts.push(dateLine)

  // Join with newlines and add request body
  const signingString = signingStringParts.join('\n') + '\n' + requestBody

  console.log('[DAX Signature Debug]')
  console.log('Method:', method)
  console.log('Request Target:', requestTarget)
  console.log('Date:', date)
  console.log('Request Body:', requestBody)
  console.log('Signing String:', signingString)

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
 * Generate ISO date string with microsecond precision for DAX API
 */
export function generateDaxDate(): string {
  const now = new Date()
  const isoString = now.toISOString()
  const microSeconds = (now.getMilliseconds() * 10000)
    .toString()
    .padStart(7, '0')
  return isoString.replace(/\.\d{3}Z$/, `.${microSeconds}Z`)
}
