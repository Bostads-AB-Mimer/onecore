import configPackage from '@iteam/config'
import dotenv from 'dotenv'

dotenv.config()

export interface Config {
  port: number
  applicationName: string
  routePrefix: string
  core: {
    url: string
  }
  logging: {
    enabled: boolean
  }
}

const config = configPackage({
  // Optional overrides file; dev, tests and the container all run from the package root.
  file: `${process.cwd()}/config.json`,
  defaults: {
    port: 7002,
    applicationName: 'leasing-portal-backend',
    // Served under core's host so core's host-only auth cookie reaches us.
    routePrefix: '/leasing-portal',
    core: {
      url: 'http://localhost:5010',
    },
    logging: {
      enabled: true,
    },
  },
})

export default {
  port: config.get('port'),
  applicationName: config.get('applicationName'),
  routePrefix: config.get('routePrefix'),
  core: config.get('core'),
  logging: config.get('logging'),
} satisfies Config
