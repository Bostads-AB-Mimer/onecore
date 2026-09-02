import configPackage from '@iteam/config'
import { type KnexConnectionParameters } from '@onecore/utilities'
import dotenv from 'dotenv'
import { projectRoot } from './dirname'

dotenv.config()

export interface Config {
  port: number
  applicationName: string
  xpandDatabase: KnexConnectionParameters
  xpandSoap: XpandSoapConfig
  logging: {
    enabled: boolean
  }
}

/**
 * Connection parameters for Xpand's Incit SOAP service, used for the write
 * operations that have no database equivalent we can safely reproduce
 * (contact creation provisions a customer number, a role and a web account
 * server-side).
 *
 * `url` is intentionally allowed to be empty. When it is, the SOAP client
 * refuses to make any call at all and reports `write-backend-not-configured`.
 * That is what keeps test and CI runs — where these variables are deliberately
 * unset — from ever reaching a live Xpand environment.
 */
export interface XpandSoapConfig {
  url: string
  username: string
  password: string
  /** LCID for the language Xpand returns messages in. 1053 = Swedish. */
  messageCulture: string
  /** Xpand tenant/company selector. '001' is Mimer. */
  companyCode: string
  timeoutMs: number
}

const config = configPackage({
  file: `${projectRoot()}/config.json`,
  defaults: {
    port: 5093,
    applicationName: 'contacts',
    xpandDatabase: {
      healthCheckInterval: 1,
      healthCheckTimeUnit: 'm',
    },
    xpandSoap: {
      // Empty by default. An unset url disables the SOAP write path entirely
      // rather than falling back to some other environment — see XpandSoapConfig.
      url: '',
      username: '',
      password: '',
      messageCulture: '1053',
      companyCode: '001',
      timeoutMs: 30000,
    },
    logging: {
      enabled: true,
    },
  },
})

export default {
  port: config.get('port'),
  logging: config.get('logging'),
  applicationName: config.get('applicationName'),
  xpandDatabase: config.get('xpandDatabase'),
  xpandSoap: config.get('xpandSoap'),
} satisfies Config
