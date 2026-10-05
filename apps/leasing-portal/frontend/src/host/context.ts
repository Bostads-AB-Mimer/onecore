import { createContext } from 'react'

import type { LeasingApi } from '../api/client'
import type { LeasingHostConfig } from './types'

export interface LeasingHostValue extends LeasingHostConfig {
  api: LeasingApi
}

export const LeasingHostContext = createContext<LeasingHostValue | null>(null)
