import { Connect } from 'vite'
import { jwtDecode } from 'jwt-decode'

let coreToken: string | null = null

export function createCoreAuthMiddleware(params: {
  url: string
  username: string
  password: string
}): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url?.startsWith('/core/api')) {
      try {
        const token = await getCoreAccessToken(params)

        req.headers['authorization'] = `Bearer ${token}`
      } catch (error) {
        console.error(error)
        res.statusCode = 500
        return res.end()
      }
    }

    return next()
  }
}

async function getCoreAccessToken(params: {
  url: string
  username: string
  password: string
}) {
  if (coreToken) {
    const jwt = jwtDecode(coreToken)
    if (jwt.exp && jwt.exp > Date.now() / 1000) {
      return coreToken
    }
  }

  const response = await fetch(`${params.url}/auth/generatetoken`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      username: params.username,
      password: params.password,
    }),
  })

  if (!response.ok) {
    throw 'onecore-core dev auth failed'
  }

  const data = (await response.json()) as { token: string }
  coreToken = data.token
  return data.token
}
