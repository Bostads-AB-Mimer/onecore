import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

interface Account {
  id: string
  userName: string
  salt: string
  hash: string
}

export interface Config {
  port: number
  core: {
    url: string
    username: string
    password: string
  }
  auth: {
    secret: string
    expiresIn: string
    maxFailedLoginAttempts: number
    cookieDomain: string
    testAccount: Account
  }
}

const config = configPackage({
  file: `${__dirname}/../../config.json`,
  defaults: {
    port: 5001,
    core: {
      url: 'http://localhost:5010',
    },
    auth: {
      secret: 'very secret. replace this',
      expiresIn: '3h', // format allowed by https://github.com/zeit/ms
      maxFailedLoginAttempts: 3,
      cookieDomain: 'localhost',
    },
  },
})

export default {
  port: config.get('port'),
  core: config.get('core'),
  auth: config.get('auth'),
} as Config
