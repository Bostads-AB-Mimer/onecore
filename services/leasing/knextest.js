const config = require('./knexfile.js')
const knex = require('knex')({
    client: 'mssql',
    connection: {
      host : '127.0.0.1',
      user : 'sa',
      password : '5CjoJ7MXTCfY7v',
      database : 'tenants-leases'
    },
  }
)

knex.select().from('knex_migrations')
.then((foo) => {
  console.log(foo);
});