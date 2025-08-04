import axios from 'axios'

export default axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || '/api',
  headers: {
    Accept: 'application/json',
    'Access-Control-Allow-Credentials': true,
  },
  withCredentials: true,
})
