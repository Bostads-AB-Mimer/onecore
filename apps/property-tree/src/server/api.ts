import express from 'express'

const app = express()
app.use(express.json())

// Mock data
const properties = [
  { id: '1', name: 'Property 1', areaId: '1' },
  { id: '2', name: 'Property 2', areaId: '2' },
]

const areas = [
  { id: '1', name: 'Area 1', properties: ['1'] },
  { id: '2', name: 'Area 2', properties: ['2'] },
]

// Endpoint to get all properties
app.get('/properties', (req, res) => {
  res.json(properties)
})

// Endpoint to get all areas
app.get('/areas', (req, res) => {
  res.json(areas)
})

// Start the server
const PORT = process.env.PORT || 5050
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
