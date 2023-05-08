import axios from 'axios'

const getRandomData = async () => {
  return (await axios('https://random-data-api.com/api/v2/appliances')).data
}

export { getRandomData }
