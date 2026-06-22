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
  stralfors: {
    baseUrl: 'https://stralfors.test',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    retryBackoffMs: 0,
    maxRetries: 10,
  },
  stralforsExport: {
    sftp: {
      host: 'test-stralfors-sftp.com',
      username: 'test-sftp-user',
      password: 'test-sftp-password',
      port: 22,
      directory: 'TEST',
    },
    notificationEmail: 'test@example.com',
  },
}
