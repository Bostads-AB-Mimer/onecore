import axios, { AxiosError, AxiosResponse } from 'axios'
import { loggedAxios, logger } from '@onecore/utilities'
import config from '../common/config'
import { AdapterResult } from './types'

export type GraphUser = {
  id: string
  userPrincipalName: string
  employeeId: string | null
  mobilePhone: string | null
  jobTitle: string | null
  officeLocation: string | null
  managerUpn: string | null
}

// Graph `manager` relationship comes back as a nested object via $expand,
// not a flat property. We flatten it to `managerUpn`; this is the raw shape
// returned by Graph before flattening.
type RawGraphUser = Omit<GraphUser, 'managerUpn'> & {
  manager?: { id: string; userPrincipalName: string | null } | null
}

type GraphError = 'graph_unreachable' | 'unauthorized' | 'forbidden' | 'unknown'

// client_credentials grant does not issue a refresh token — the client authenticates
// directly with its own credentials, so re-requesting a new token is the only option.
let cachedToken: { value: string; expiresAt: number } | null = null
// Holds the in-flight token request so concurrent callers share one request instead of
// each firing their own, preventing a thundering herd when the token expires.
let tokenPromise: Promise<string> | null = null

async function fetchNewToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = config.microsoftGraph
  const res = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  cachedToken = {
    value: res.data.access_token,
    // expires_in is in seconds; subtract 30 s in getGraphToken to renew before expiry
    expiresAt: Date.now() + res.data.expires_in * 1000,
  }
  return cachedToken.value
}

async function getGraphToken(): Promise<string> {
  // Serve from cache if the token is still valid with 30 s to spare
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value
  }
  // Deduplicate concurrent refresh attempts — only one HTTP call goes out
  if (!tokenPromise) {
    tokenPromise = fetchNewToken().finally(() => (tokenPromise = null))
  }
  return tokenPromise
}

export async function listUsers(): Promise<
  AdapterResult<GraphUser[], GraphError>
> {
  try {
    const token = await getGraphToken()
    const url = new URL('https://graph.microsoft.com/v1.0/users')
    url.searchParams.set(
      '$select',
      'id,userPrincipalName,employeeId,mobilePhone,jobTitle,officeLocation'
    )
    // `manager` is a navigation property, so it must be $expand'ed, not $select'ed.
    // $expand on the /users collection caps page size, so $top is lowered to 100.
    url.searchParams.set('$expand', 'manager($select=id,userPrincipalName)')
    url.searchParams.set('$top', '100')

    const users: GraphUser[] = []
    let nextUrl: string | undefined = url.toString()

    while (nextUrl) {
      const res: AxiosResponse<{
        value: RawGraphUser[]
        '@odata.nextLink'?: string
      }> = await loggedAxios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      users.push(
        ...res.data.value.map(({ manager, ...rest }) => ({
          ...rest,
          managerUpn: manager?.userPrincipalName ?? null,
        }))
      )
      nextUrl = res.data['@odata.nextLink']
    }

    return { ok: true, data: users }
  } catch (err) {
    logger.error({ err }, 'microsoft-graph-adapter.listUsers')
    if (err instanceof AxiosError) {
      if (!err.response)
        return { ok: false, err: 'graph_unreachable', statusCode: 502 }
      const status = err.response.status
      if (status === 401)
        return { ok: false, err: 'unauthorized', statusCode: status }
      if (status === 403)
        return { ok: false, err: 'forbidden', statusCode: status }
      return { ok: false, err: 'unknown', statusCode: status }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}
