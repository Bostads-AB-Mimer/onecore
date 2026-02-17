import createClient from 'openapi-fetch'

import { authConfig } from '@/auth-config'

import type { paths as CorePaths } from './generated/api-types'
import type { paths as KeysPaths } from '../generated/api-types'

type AllPaths = CorePaths & KeysPaths

export const client = createClient<AllPaths>({
  baseUrl: authConfig.apiUrl,
  credentials: 'include',
})

export const { GET, POST, PUT, PATCH, DELETE } = client

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
