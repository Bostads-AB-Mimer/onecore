import configPackage from '@iteam/config'
import dotenv from 'dotenv'
dotenv.config()

export interface Config {
  port: number
  email: {
    host: string
    username: string
    password: string
    port: number
    senderAddress: string
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5020,
    email: {
      host: 'smtp.sendgrid.net',
      username: 'apikey',
      password: '[insert value]',
      port: 587, // SMTP
      senderAddress: 'noreply@mimer.nu',
    },
  },
})

export default {
  port: config.get('port'),
  email: config.get('email'),
} as Config
