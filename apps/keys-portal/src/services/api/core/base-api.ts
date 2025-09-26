import createClient from 'openapi-fetch'

import { authConfig } from '@/auth-config'

import type { paths } from './generated/api-types'

export const client = createClient<paths>({
  baseUrl: authConfig.apiUrl,
  credentials: 'include',
})

export const { GET, POST, PUT, PATCH, DELETE } = client

type UrlParams = {
  path?: Record<string, string | number>
  query?: Record<string, string | number | boolean | null | undefined>
}

function buildUrl(path: string, params?: UrlParams) {
  let urlPath = path
  if (params?.path) {
    for (const [k, v] of Object.entries(params.path)) {
      urlPath = urlPath.replace(`{${k}}`, encodeURIComponent(String(v)))
    }
  }
  const url = new URL(urlPath, authConfig.apiUrl)
  if (params?.query) {
    for (const [k, v] of Object.entries(params.query)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v))
    }
  }
  return url.toString()
}

export async function GET_BLOB(
  path: string,
  opts?: { params?: UrlParams; headers?: Record<string, string> }
): Promise<{ data?: Blob; error?: string }> {
  try {
    const url = buildUrl(path, opts?.params)
    const res = await fetch(url, {
      method: 'GET',
      headers: opts?.headers,
      credentials: 'include',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { error: text || res.statusText }
    }
    const blob = await res.blob()
    return { data: blob }
  } catch (e: any) {
    return { error: e?.message ?? 'network-error' }
  }
}

export function POST_FORM_GENERATE_TOKEN(body: {
  username?: string
  password?: string
}) {
  return client.POST('/auth/generatetoken', {
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    bodySerializer: (data) =>
      new URLSearchParams(
        Object.entries((data ?? {}) as Record<string, string>)
      ).toString(),
  })
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
