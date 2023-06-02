import configPackage from '@iteam/config'

export interface Config {
  port: number
  tenantsContractsService: {
    url: string
  }
}

const config = configPackage({
  file: `${__dirname}/../config.json`,
  defaults: {
    port: 5010,
    tenantsContractsService: {
      url: 'http://localhost:5020',
    },
  },
})

export default {
  port: config.get('port'),
  tenantsContractsService: config.get('tenantsContractsService'),
} as Config
