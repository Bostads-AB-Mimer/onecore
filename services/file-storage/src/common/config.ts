import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  health: {
    minimumMinutesBetweenRequests: number
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5091,
    health: {
      minimumMinutesBetweenRequests: 1,
    },
  },
})

export default {
  port: config.get('port'),
  health: config.get('health'),
} as Config
