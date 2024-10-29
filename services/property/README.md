# property-base
POC to investigate Prisma as data-layer between Xpand and ONECore 

## Installation 

1. `npm install`
2. create a copy of `.env.template` and name it `.env`. Supply credentials to your database. 
3. `prisma generate` to generate the Prisma client. The client will reside in `node_modules` and changes to the schema will require a new generation of the client.
4. `npm run dev` to start the server.