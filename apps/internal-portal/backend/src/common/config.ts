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
    adapter: string
    secret: string
    expiresIn: string
    maxFailedLoginAttempts: number
    cookieDomain: string
    testAccount: Account
    msal: {
      clientId: string
      cloudInstance: string
      tenantId: string
      clientSecret: string
      redirectUri: string
      graphApiEndpoint: string
      postLogoutRedirectUri: string
    }
    core: {
      redirectUri: string
      postLogoutRedirectUri: string
    }
  }
  /* This is deprecated, but kept around for compatibility... until one day */
  msal: {
    clientId: string
    cloudInstance: string
    tenantId: string
    clientSecret: string
    redirectUri: string
    graphApiEndpoint: string
    postLogoutRedirectUri: string
  }
}

const config = configPackage({
  file: `${__dirname}/../../config.json`,
  defaults: {
    port: 7001,
    core: {
      url: 'http://localhost:5010',
    },
    auth: {
      adapter: 'core',
      secret: 'very secret. replace this',
      expiresIn: '3h', // format allowed by https://github.com/zeit/ms
      maxFailedLoginAttempts: 3,
      cookieDomain: 'localhost',
      msal: {
        clientId: '',
        cloudInstance: 'https://login.microsoftonline.com/',
        tenantId: '',
        clientSecret: '',
        graphApiEndpoint: 'https://graph.microsoft.com/',
      },
      core: {},
    },
    /* This is deprecated, but kept around for compatibility... until one day */
    msal: {
      clientId: '',
      cloudInstance: 'https://login.microsoftonline.com/',
      tenantId: '',
      clientSecret: '',
      graphApiEndpoint: 'https://graph.microsoft.com/',
    },
  },
})

export default {
  port: config.get('port'),
  core: config.get('core'),
  auth: config.get('auth'),
  msal: config.get('msal'),
} as Config
