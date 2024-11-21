import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
app.use(express.json());

// Proxy configuration
app.use(
  '/properties',
  createProxyMiddleware({
    target: 'http://localhost:5050',
    changeOrigin: true,
  })
);

app.use(
  '/areas',
  createProxyMiddleware({
    target: 'http://localhost:5050',
    changeOrigin: true,
  })
);

// Start the server
const PORT = process.env.PORT || 5050
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
