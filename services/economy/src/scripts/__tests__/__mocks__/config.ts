export default {
  debtCollection: {
    xledger: {
      sftp: {
        host: 'test-xledger-host.com',
        username: 'test-user',
        password: 'test-password',
        port: 22,
        useSshDss: false,
      },
      rentInvoicesDirectory: '/test/rent-invoices',
      otherInvoicesDirectory: '/test/other-invoices',
      balanceCorrectionsDirectory: '/test/balance-corrections',
    },
    sergel: {
      sftp: {
        host: 'test-sergel-host.com',
        username: 'test-sergel-user',
        password: 'test-sergel-password',
        port: 22,
      },
      directory: '/test/sergel-export',
    },
  },
  infobip: {
    baseUrl: 'http://localhost',
    apiKey: 'abc123',
  },
}
