import { useContext } from 'react'

import { LeasingHostContext } from './context'

export function useLeasingHost() {
  const value = useContext(LeasingHostContext)
  if (!value) {
    throw new Error('useLeasingHost must be used inside a LeasingHostProvider')
  }
  return value
}
