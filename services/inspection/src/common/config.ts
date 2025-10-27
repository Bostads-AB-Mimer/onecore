import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  inspectionDatabase: {
    host: string
    user: string
    password: string
    port: number
    database: string
  }
  health: {
    inspectionDatabase: {
      systemName: string
      minimumMinutesBetweenRequests: number
    }
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5090,
    inspectionDatabase: {
      host: '',
      user: '',
      password: '',
      port: 1438,
      database: '',
    },
    health: {
      inspectionDatabase: {
        systemName: 'inspection database',
        minimumMinutesBetweenRequests: 1,
      },
    },
  },
})

export default {
  port: config.get('port'),
  inspectionDatabase: config.get('inspectionDatabase'),
  health: config.get('health'),
} as Config
