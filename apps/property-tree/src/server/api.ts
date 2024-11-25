import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const app = express()
app.use(express.json())

// Get target URL from environment variable or use default
const TARGET_URL = process.env.API_URL || 'http://localhost:5050'

// Configure proxy middleware
const apiProxy = createProxyMiddleware({
  target: TARGET_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove /api prefix when forwarding
  },
  logLevel: 'debug',
})

// Use proxy middleware for all /api routes
app.use('/api', apiProxy)

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Proxying /api requests to ${TARGET_URL}`)
})
