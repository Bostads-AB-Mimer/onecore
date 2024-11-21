import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// Handle /properties requests
app.get('/properties', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5050/properties');
    const modifiedData = response.data.map((property) => {
      // Modify the property data as needed
      return {
        ...property,
        // Example modification: add a new field
        modified: true,
      };
    });
    res.json(modifiedData);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Handle /areas requests
app.get('/areas', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:5050/areas');
    const modifiedData = response.data.map((area) => {
      // Modify the area data as needed
      return {
        ...area,
        // Example modification: add a new field
        modified: true,
      };
    });
    res.json(modifiedData);
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// Start the server
const PORT = process.env.PORT || 5050
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
